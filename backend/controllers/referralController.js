const User = require('../models/User');
const Transaction = require('../models/Transaction');

// GET /api/referral/stats
exports.getReferralStats = async (req, res, next) => {
  try {
    const user = req.user;

    const referredUsers = await User.find({ referredBy: user.referralCode })
      .select('name phone createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const referralTransactions = await Transaction.find({
      userId: user._id,
      description: { $regex: /^Referral/ },
      type: 'earn',
    }).lean();

    const totalReferralEarnings = referralTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        totalReferred: referredUsers.length,
        totalReferralEarnings,
        referrals: referredUsers.map((u) => ({
          name: u.name,
          phone: u.phone.slice(-4).padStart(10, '*'),
          joinedAt: u.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
