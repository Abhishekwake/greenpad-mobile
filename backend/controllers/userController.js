const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Lead = require('../models/Lead');

// GET /api/user/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, recentTransactions, leadCount, referralCount] = await Promise.all([
      User.findById(userId).select('name phone coins totalEarned totalRedeemed referralCode'),
      Transaction.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      Lead.countDocuments({ userId }),
      User.countDocuments({ referredBy: req.user.referralCode }),
    ]);

    res.json({
      success: true,
      data: {
        user: {
          name: user.name,
          phone: user.phone,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalRedeemed: user.totalRedeemed,
          referralCode: user.referralCode,
        },
        stats: {
          totalReferrals: referralCount,
          totalLeads: leadCount,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/user/profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/push-token
exports.updatePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'pushToken is required' });
    }

    await User.findByIdAndUpdate(req.user._id, { pushToken });
    res.json({ success: true, message: 'Push token saved' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'email'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.name && updates.name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-__v');

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
