const User = require('../models/User');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function last30DaysKeys() {
  const keys = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalLeads,
      conversions,
      totalCoinsEarned,
      statusBreakdown,
      signupsAgg,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'converted' }),
      Transaction.aggregate([
        { $match: { type: 'earn', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.find()
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const dayMap = signupsAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const signupsPerDay = last30DaysKeys().map((date) => ({
      date,
      count: dayMap[date] || 0,
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLeads,
        conversions,
        conversionRate: totalLeads > 0 ? Number(((conversions / totalLeads) * 100).toFixed(1)) : 0,
        totalCoinsIssued: totalCoinsEarned[0]?.total || 0,
        leadsByStatus: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        signupsPerDay,
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/leads?status=&search=&page=&limit=
exports.getLeads = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    const leadStatuses = [
      'pending',
      'contacted',
      'visited',
      'converted',
      'cancelled',
      'not_converted',
      'rejected',
    ];
    if (status && leadStatuses.includes(status)) {
      filter.status = status;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const digits = q.replace(/\D/g, '');
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        ...(digits ? [{ phone: new RegExp(escapeRegex(digits), 'i') }] : []),
      ];
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('userId', 'name phone referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/lead/:id/status
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'pending',
      'contacted',
      'visited',
      'converted',
      'cancelled',
      'not_converted',
      'rejected',
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const lead = await Lead.findById(id).populate('userId');
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const previousStatus = lead.status;
    lead.status = status;
    await lead.save();

    const awardUserId = lead.userId;
    const shouldAwardVisit =
      status === 'visited' &&
      previousStatus !== 'visited' &&
      !['cancelled', 'not_converted', 'rejected'].includes(previousStatus);
    const shouldAwardConvert =
      status === 'converted' &&
      previousStatus !== 'converted' &&
      !['cancelled', 'not_converted', 'rejected'].includes(previousStatus);

    if (status !== previousStatus && awardUserId) {
      const referrer = awardUserId;

      if (shouldAwardVisit) {
        referrer.coins += 500;
        referrer.totalEarned += 500;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: 500,
          description: `Lead visited: ${lead.name}`,
          relatedTo: { model: 'Lead', id: lead._id },
        });
      }

      if (shouldAwardConvert) {
        referrer.coins += 2000;
        referrer.totalEarned += 2000;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: 2000,
          description: `Installation confirmed: ${lead.name}`,
          relatedTo: { model: 'Lead', id: lead._id },
        });
      }
    }

    res.json({
      success: true,
      message: `Lead status updated to ${status}`,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users?search=&page=&limit=
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (search && String(search).trim()) {
      const digits = String(search).replace(/\D/g, '');
      if (digits) {
        filter.phone = new RegExp(escapeRegex(digits), 'i');
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    const usersWithRefs = await Promise.all(
      users.map(async (u) => ({
        ...u,
        totalReferrals: u.referralCode
          ? await User.countDocuments({ referredBy: u.referralCode })
          : 0,
      }))
    );

    res.json({
      success: true,
      data: {
        users: usersWithRefs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/user/:id
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [transactions, leads, totalReferrals] = await Promise.all([
      Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Lead.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      user.referralCode
        ? User.countDocuments({ referredBy: user.referralCode })
        : Promise.resolve(0),
    ]);

    res.json({
      success: true,
      data: {
        user,
        transactions,
        leads,
        totalReferrals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/rewards
exports.listRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find().sort({ coinsRequired: 1 }).lean();
    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/reward
exports.createReward = async (req, res, next) => {
  try {
    const { title, description, coinsRequired, icon, stock } = req.body;

    if (!title || !description || coinsRequired == null) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and coinsRequired are mandatory',
      });
    }

    const coins = Number(coinsRequired);
    if (Number.isNaN(coins) || coins < 50) {
      return res.status(400).json({
        success: false,
        message: 'coinsRequired must be at least 50',
      });
    }

    const reward = await Reward.create({
      title,
      description,
      coinsRequired: coins,
      icon: icon || '🎁',
      stock: stock === '' || stock === undefined || stock === null ? null : Number(stock),
    });

    res.status(201).json({ success: true, data: reward });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/reward/:id
exports.updateReward = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['title', 'description', 'coinsRequired', 'icon', 'stock', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.coinsRequired != null) {
      const c = Number(updates.coinsRequired);
      if (Number.isNaN(c) || c < 50) {
        return res.status(400).json({ success: false, message: 'coinsRequired must be at least 50' });
      }
      updates.coinsRequired = c;
    }

    const reward = await Reward.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }

    res.json({ success: true, data: reward });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/reward/:id
exports.deleteReward = async (req, res, next) => {
  try {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }
    res.json({ success: true, message: 'Reward deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/transactions?type=&startDate=&endDate=&page=&limit=
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (type && ['earn', 'redeem', 'pending'].includes(type)) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [rows, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
