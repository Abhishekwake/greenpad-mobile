const User = require('../models/User');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalLeads, conversions, totalCoinsEarned] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'converted' }),
      Transaction.aggregate([
        { $match: { type: 'earn', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const statusBreakdown = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLeads,
        conversions,
        conversionRate: totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : 0,
        totalCoinsEarned: totalCoinsEarned[0]?.total || 0,
        leadsByStatus: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/leads?status=pending&page=1&limit=20
exports.getLeads = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (status && ['pending', 'contacted', 'visited', 'converted', 'rejected'].includes(status)) {
      filter.status = status;
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
          pages: Math.ceil(total / Number(limit)),
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

    const validStatuses = ['pending', 'contacted', 'visited', 'converted', 'rejected'];
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

    // Award coins to referrer when lead status changes
    if (status !== previousStatus) {
      const referrer = lead.userId;

      if (status === 'visited' && previousStatus !== 'visited') {
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

      if (status === 'converted' && previousStatus !== 'converted') {
        referrer.coins += 2000;
        referrer.totalEarned += 2000;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: 2000,
          description: `Lead converted: ${lead.name}`,
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

// GET /api/admin/users?page=1&limit=20
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find()
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/reward
exports.createReward = async (req, res, next) => {
  try {
    const { title, description, coinsRequired, icon, stock } = req.body;

    if (!title || !description || !coinsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and coinsRequired are mandatory',
      });
    }

    const reward = await Reward.create({
      title,
      description,
      coinsRequired,
      icon: icon || '🎁',
      stock: stock ?? null,
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
