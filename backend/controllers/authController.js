const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generateOTP, storeOTP, verifyOTP, sendOTPViaSMS } = require('../utils/sendOTP');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
}

// POST /api/auth/send-otp
exports.sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' });
    }

    const otp = generateOTP();
    storeOTP(phone, otp);
    await sendOTPViaSMS(phone, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Return OTP in development for easy testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (error) {
    next(error);
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

      await Transaction.create({
        userId: user._id,
        type: 'earn',
        amount: 200,
        description: 'Welcome bonus',
        relatedTo: { model: 'User', id: user._id },
      });

      user.coins += 200;
      user.totalEarned += 200;
      await user.save();
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

    const user = await User.findById(userId);
    if (user.referredBy) {
      return res.status(400).json({ success: false, message: 'You have already used a referral code' });
    }
    if (user.referralCode === referralCode) {
      return res.status(400).json({ success: false, message: 'You cannot use your own code' });
    }

    const referrer = await User.findOne({ referralCode, isActive: true });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    // Award coins to the new user
    user.referredBy = referralCode;
    user.coins += 200;
    user.totalEarned += 200;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'earn',
      amount: 200,
      description: `Referral bonus (code: ${referralCode})`,
      relatedTo: { model: 'User', id: referrer._id },
    });

    // Award coins to referrer
    referrer.coins += 300;
    referrer.totalEarned += 300;
    await referrer.save();

    await Transaction.create({
      userId: referrer._id,
      type: 'earn',
      amount: 300,
      description: `Referral signup: ${user.name}`,
      relatedTo: { model: 'User', id: user._id },
    });

    res.json({
      success: true,
      message: 'Referral code applied! +200 coins earned',
      coins: user.coins,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/admin-login
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@greenpad.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    if (email.toLowerCase().trim() !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    let admin = await User.findOne({ role: 'admin' });
    const seedPhone = process.env.ADMIN_SEED_PHONE || '9000000001';

    if (!admin) {
      const existingPhone = await User.findOne({ phone: seedPhone });
      if (existingPhone) {
        existingPhone.role = 'admin';
        existingPhone.email = adminEmail;
        existingPhone.name = existingPhone.name || 'Admin';
        await existingPhone.save();
        admin = existingPhone;
      } else {
        admin = await User.create({
          name: 'Admin',
          phone: seedPhone,
          email: adminEmail,
          role: 'admin',
        });
      }
    }

    const token = signToken(admin._id);

    res.json({
      success: true,
      token,
      user: {
        name: admin.name,
        email: admin.email || adminEmail,
      },
    });
  } catch (error) {
    next(error);
  }
};
