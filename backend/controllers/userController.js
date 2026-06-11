const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const { linkUserToLeadsByPhone } = require('../utils/linkUserToLeadsByPhone');

// GET /api/user/dashboard
const SITE_VISIT_LABELS = {
  pending: 'Site visit scheduled',
  contacted: 'We will contact you soon',
  visited: 'Site visit completed',
  converted: 'Approved — installation starting',
  lost: 'Visit closed',
};

exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await linkUserToLeadsByPhone(req.user);

    const phone = String(req.user.phone || '').trim();
    const leadFilter = /^\d{10}$/.test(phone)
      ? { status: { $ne: 'voided' }, $or: [{ userId }, { phone }] }
      : { userId, status: { $ne: 'voided' } };

    const [user, recentTransactions, leadCount, referralCount, latestLead, project] =
      await Promise.all([
        User.findById(userId).select('name phone coins totalEarned totalRedeemed referralCode'),
        Transaction.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
        Lead.countDocuments(leadFilter),
        User.countDocuments({ referredBy: req.user.referralCode }),
        Lead.findOne(leadFilter).sort({ updatedAt: -1 }).lean(),
        Project.findOne({ customerId: userId, status: { $ne: 'voided' } })
          .select('status currentStageId')
          .lean(),
      ]);

    let projectSummary = null;
    if (project) {
      projectSummary = { status: project.status, hasProject: true };
    } else if (latestLead) {
      const byLead = await Project.findOne({
        leadId: latestLead._id,
        status: { $ne: 'voided' },
      })
        .select('status')
        .lean();
      if (byLead) projectSummary = { status: byLead.status, hasProject: true };
    }

    const siteVisit = latestLead
      ? {
          leadId: String(latestLead._id),
          status: latestLead.status,
          statusLabel: SITE_VISIT_LABELS[latestLead.status] || latestLead.status,
          preferredDate: latestLead.preferredDate,
          timeSlot: latestLead.timeSlot,
          source: latestLead.source || 'mobile',
        }
      : null;

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
        siteVisit,
        project: projectSummary,
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
