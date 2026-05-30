const User = require('../models/User');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const { pipelineFromLeadStatus } = require('../utils/referralPipeline');

// GET /api/referral/stats
exports.getReferralStats = async (req, res, next) => {
  try {
    const user = req.user;

    const referredUsers = await User.find({ referredBy: user.referralCode })
      .select('name phone createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const phones = referredUsers.map((u) => u.phone).filter(Boolean);
    const leadsByPhone = new Map();

    if (phones.length > 0) {
      const leads = await Lead.find({ phone: { $in: phones } })
        .select('phone status createdAt')
        .sort({ createdAt: -1 })
        .lean();

      for (const lead of leads) {
        if (!leadsByPhone.has(lead.phone)) {
          leadsByPhone.set(lead.phone, lead);
        }
      }
    }

    const referralTransactions = await Transaction.find({
      userId: user._id,
      description: { $regex: /^Referral/ },
      type: 'earn',
    }).lean();

    const totalReferralEarnings = referralTransactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        totalReferred: referredUsers.length,
        totalReferralEarnings,
        referrals: referredUsers.map((u) => {
          const lead = leadsByPhone.get(u.phone);
          const pipeline = lead
            ? pipelineFromLeadStatus(lead.status)
            : pipelineFromLeadStatus(null);

          return {
            name: u.name,
            phone: u.phone.slice(-4).padStart(10, '*'),
            joinedAt: u.createdAt,
            pipelineStatus: pipeline.pipelineStatus,
            pipelineLabel: pipeline.pipelineLabel,
            leadStatus: lead?.status || null,
          };
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};
