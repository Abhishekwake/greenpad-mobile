const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');
const Agent = require('../models/Agent');
const AppSettings = require('../models/AppSettings');
const { getCoinSettings } = require('../utils/getCoinSettings');

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
      pendingRedemptions,
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
      Transaction.countDocuments({ type: 'redeem', status: 'pending' }),
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
        pendingRedemptions,
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
    const leadStatuses = ['pending', 'contacted', 'visited', 'converted', 'lost'];
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
        .populate('assignedAgent', 'name role phone email isActive')
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

    const validStatuses = ['pending', 'contacted', 'visited', 'converted', 'lost'];
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
    // Capture referrer id before save — Mongoose may depopulate `userId` after save(), which
    // would leave `lead.userId` as an ObjectId and break `referrer.coins` updates.
    const rawReferrer = lead.userId;
    const referrerId =
      rawReferrer && typeof rawReferrer === 'object' && rawReferrer._id
        ? rawReferrer._id
        : rawReferrer;

    lead.status = status;
    await lead.save();

    const shouldAwardVisit =
      status === 'visited' && previousStatus !== 'visited' && previousStatus !== 'lost';
    const shouldAwardConvert =
      status === 'converted' && previousStatus !== 'converted' && previousStatus !== 'lost';
    // If admin marks "converted" without a separate "visited" step, still grant the visit milestone once.
    const shouldAwardVisitOnConvert =
      shouldAwardConvert && previousStatus !== 'visited' && previousStatus !== 'lost';

    if (status !== previousStatus && referrerId) {
      const referrer = await User.findById(referrerId);
      if (!referrer) {
        return res.json({
          success: true,
          message: `Lead status updated to ${status}`,
          data: lead,
          warning: 'Referring user not found; no coins were awarded',
        });
      }

      const coinCfg = await getCoinSettings();
      const visitCoins = coinCfg.coinsLeadVisited;
      const visitOnConvertCoins = coinCfg.coinsLeadVisitMilestoneOnConvert;
      const convertCoins = coinCfg.coinsLeadConverted;

      if (shouldAwardVisit) {
        referrer.coins += visitCoins;
        referrer.totalEarned += visitCoins;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: visitCoins,
          description: `Lead visited: ${lead.name}`,
          relatedTo: { model: 'Lead', id: lead._id },
        });
      }

      if (shouldAwardVisitOnConvert) {
        referrer.coins += visitOnConvertCoins;
        referrer.totalEarned += visitOnConvertCoins;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: visitOnConvertCoins,
          description: `Lead visited: ${lead.name}`,
          relatedTo: { model: 'Lead', id: lead._id },
        });
      }

      if (shouldAwardConvert) {
        referrer.coins += convertCoins;
        referrer.totalEarned += convertCoins;
        await referrer.save();
        await Transaction.create({
          userId: referrer._id,
          type: 'earn',
          amount: convertCoins,
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

// GET /api/admin/redemptions?status=pending|completed|cancelled|failed|all&page=&limit=
exports.getRedemptions = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { type: 'redeem' };
    if (status && status !== 'all' && ['pending', 'completed', 'cancelled', 'failed'].includes(String(status))) {
      filter.status = status;
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

    const rewardIds = rows
      .filter((r) => r.relatedTo?.model === 'Reward' && r.relatedTo?.id)
      .map((r) => r.relatedTo.id);
    const rewards =
      rewardIds.length > 0
        ? await Reward.find({ _id: { $in: rewardIds } }).select('title icon coinsRequired').lean()
        : [];
    const rewardMap = Object.fromEntries(rewards.map((rw) => [String(rw._id), rw]));

    const redemptions = rows.map((r) => ({
      ...r,
      reward:
        r.relatedTo?.model === 'Reward' && r.relatedTo?.id
          ? rewardMap[String(r.relatedTo.id)] || null
          : null,
    }));

    res.json({
      success: true,
      data: {
        redemptions,
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

// PATCH /api/admin/redemption/:id  body: { status: 'completed' | 'cancelled' }
exports.updateRedemptionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be "completed" or "cancelled"',
      });
    }

    const tx = await Transaction.findById(id);
    if (!tx || tx.type !== 'redeem') {
      return res.status(404).json({ success: false, message: 'Redemption not found' });
    }
    if (tx.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending redemptions can be updated',
      });
    }

    if (status === 'completed') {
      tx.status = 'completed';
      tx.fulfilledAt = new Date();
      await tx.save();
      return res.json({
        success: true,
        message: 'Marked as fulfilled',
        data: tx,
      });
    }

    const coins = Math.abs(Number(tx.amount) || 0);
    const user = await User.findById(tx.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found for this redemption' });
    }
    user.coins += coins;
    user.totalRedeemed = Math.max(0, (user.totalRedeemed || 0) - coins);
    await user.save();

    if (tx.relatedTo?.model === 'Reward' && tx.relatedTo.id) {
      const reward = await Reward.findById(tx.relatedTo.id);
      if (reward && reward.stock != null) {
        reward.stock += 1;
        await reward.save();
      }
    }

    tx.status = 'cancelled';
    await tx.save();

    return res.json({
      success: true,
      message: 'Redemption cancelled and coins refunded',
      data: { transaction: tx, coinsRefunded: coins },
    });
  } catch (error) {
    next(error);
  }
};

// --- Coin rules (AppSettings) ---

// GET /api/admin/coin-settings
exports.getCoinSettingsAdmin = async (req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({
      success: true,
      data: {
        coinsSelfBook: doc.coinsSelfBook,
        coinsReferralBook: doc.coinsReferralBook,
        coinsLeadVisited: doc.coinsLeadVisited,
        coinsLeadVisitMilestoneOnConvert: doc.coinsLeadVisitMilestoneOnConvert,
        coinsLeadConverted: doc.coinsLeadConverted,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/coin-settings
exports.putCoinSettingsAdmin = async (req, res, next) => {
  try {
    const keys = [
      'coinsSelfBook',
      'coinsReferralBook',
      'coinsLeadVisited',
      'coinsLeadVisitMilestoneOnConvert',
      'coinsLeadConverted',
    ];
    const updates = {};
    for (const k of keys) {
      if (req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== '') {
        const n = Number(req.body[k]);
        if (Number.isNaN(n) || n < 0 || n > 500000) {
          return res.status(400).json({ success: false, message: `Invalid value for ${k}` });
        }
        updates[k] = Math.round(n);
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const doc = await AppSettings.findOneAndUpdate(
      { singletonKey: 'global' },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Coin rules saved',
      data: {
        coinsSelfBook: doc.coinsSelfBook,
        coinsReferralBook: doc.coinsReferralBook,
        coinsLeadVisited: doc.coinsLeadVisited,
        coinsLeadVisitMilestoneOnConvert: doc.coinsLeadVisitMilestoneOnConvert,
        coinsLeadConverted: doc.coinsLeadConverted,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// --- Agents ---

// GET /api/admin/agents?includeInactive=1
exports.listAgents = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === '1';
    const filter = includeInactive ? {} : { isActive: true };
    const agents = await Agent.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: agents });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/agent
exports.createAgent = async (req, res, next) => {
  try {
    const { name, role, phone, email } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const agent = await Agent.create({
      name: String(name).trim(),
      role: role != null ? String(role).trim().slice(0, 80) : '',
      phone: phone != null ? String(phone).trim().slice(0, 20) : '',
      email: email != null ? String(email).trim().slice(0, 120) : '',
    });
    res.status(201).json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/agent/:id
exports.updateAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'role', 'phone', 'email', 'isActive'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (updates.name != null) updates.name = String(updates.name).trim();
    if (updates.role != null) updates.role = String(updates.role).trim().slice(0, 80);
    if (updates.phone != null) updates.phone = String(updates.phone).trim().slice(0, 20);
    if (updates.email != null) updates.email = String(updates.email).trim().slice(0, 120);
    if (Object.prototype.hasOwnProperty.call(updates, 'isActive')) {
      updates.isActive = Boolean(updates.isActive);
    } else {
      delete updates.isActive;
    }

    const agent = await Agent.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    res.json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/lead/:id/assign  body: { assignedAgentId: string | null }
exports.updateLeadAssign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedAgentId } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (assignedAgentId === null || assignedAgentId === '' || assignedAgentId === undefined) {
      lead.assignedAgent = null;
    } else if (!mongoose.Types.ObjectId.isValid(assignedAgentId)) {
      return res.status(400).json({ success: false, message: 'Invalid agent id' });
    } else {
      const agent = await Agent.findOne({ _id: assignedAgentId, isActive: true });
      if (!agent) {
        return res.status(400).json({ success: false, message: 'Agent not found or inactive' });
      }
      lead.assignedAgent = agent._id;
    }

    await lead.save();

    const updated = await Lead.findById(id)
      .populate('userId', 'name phone referralCode')
      .populate('assignedAgent', 'name role phone email isActive')
      .lean();

    res.json({ success: true, message: 'Assignment updated', data: updated });
  } catch (error) {
    next(error);
  }
};
