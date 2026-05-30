const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');
const { generateOTP, storeOTP, verifyOTP, sendOTPViaSMS } = require('../utils/sendOTP');
const { runWithTransaction, awardCoins, MILESTONE_TYPES } = require('../utils/coinService');
const { getCoinSettings } = require('../utils/getCoinSettings');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
}

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin._id, typ: 'admin', adminRole: admin.adminRole },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
}

function shouldExposeOtpInResponse() {
  return (
    process.env.NODE_ENV === 'development' || process.env.EXPOSE_OTP_IN_RESPONSE === 'true'
  );
}

// POST /api/auth/send-otp
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' });
    }

    const otp = generateOTP();
    storeOTP(phone, otp);

    console.log('[send-otp] ip=%s phone=%s****', req.ip, String(phone).slice(0, 2));
    console.log('Generated OTP:', otp);

    try {
      await sendOTPViaSMS(phone, otp);
    } catch (smsErr) {
      console.error('[send-otp] SMS helper error (OTP still stored):', smsErr?.message || smsErr);
    }

    const exposeOtp = shouldExposeOtpInResponse();
    if (!exposeOtp && process.env.NODE_ENV === 'production') {
      console.log('[send-otp] OTP not included in JSON (set EXPOSE_OTP_IN_RESPONSE=true on host to test)');
    }

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      ...(exposeOtp && { otp }),
    });
  } catch (error) {
    console.error('[send-otp] fatal:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          process.env.NODE_ENV === 'development'
            ? error.message || 'Server error'
            : 'Failed to send OTP. Please try again.',
      });
    }
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' });
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Valid 6-digit OTP required' });
    }

    const result = verifyOTP(phone, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    let user = await User.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: `User ${phone.slice(-4)}`,
        phone,
      });

      const coinCfg = await getCoinSettings();

      await runWithTransaction(async (session) => {
        await awardCoins({
          session,
          userId: user._id,
          amount: coinCfg.coinsWelcomeBonus,
          description: 'Welcome bonus',
          relatedTo: { model: 'User', id: user._id },
          milestoneType: MILESTONE_TYPES.WELCOME_BONUS,
        });
      });

      user = await User.findById(user._id);
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        referralCode: user.referralCode,
        coins: user.coins,
        role: user.role,
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/apply-referral
exports.applyReferral = async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user._id;

    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code required' });
    }

    const existingUser = await User.findById(userId);
    if (existingUser.referredBy) {
      return res.status(400).json({ success: false, message: 'You have already used a referral code' });
    }
    if (existingUser.referralCode === referralCode) {
      return res.status(400).json({ success: false, message: 'You cannot use your own code' });
    }

    const referrer = await User.findOne({ referralCode, isActive: true });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    const coinCfg = await getCoinSettings();

    const result = await runWithTransaction(async (session) => {
      const user = await User.findOneAndUpdate(
        { _id: userId, referredBy: null },
        { referredBy: referralCode },
        { session, new: true }
      );

      if (!user) {
        return { ok: false, message: 'You have already used a referral code' };
      }

      await awardCoins({
        session,
        userId: user._id,
        amount: coinCfg.coinsReferralSignupReferee,
        description: `Referral bonus (code: ${referralCode})`,
        relatedTo: { model: 'User', id: referrer._id },
        milestoneType: MILESTONE_TYPES.REFERRAL_SIGNUP_REFEREE,
      });

      await awardCoins({
        session,
        userId: referrer._id,
        amount: coinCfg.coinsReferralSignupReferrer,
        description: `Referral signup: ${user.name}`,
        relatedTo: { model: 'User', id: user._id },
        milestoneType: MILESTONE_TYPES.REFERRAL_SIGNUP_REFERRER,
      });

      return { ok: true, user, refereeCoins: coinCfg.coinsReferralSignupReferee };
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const updatedUser = await User.findById(userId);

    res.json({
      success: true,
      message: `Referral code applied! +${result.refereeCoins} coins earned`,
      coins: updatedUser.coins,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/admin-login
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const admin = await AdminAccount.findOne({ email: normalizedEmail });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(String(password), admin.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = signAdminToken(admin);

    res.json({
      success: true,
      token,
      user: {
        name: admin.name,
        email: admin.email,
        adminRole: admin.adminRole,
      },
    });
  } catch (error) {
    next(error);
  }
};
