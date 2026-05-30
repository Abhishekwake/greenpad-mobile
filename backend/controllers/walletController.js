const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { runWithTransaction, atomicRedeem } = require('../utils/coinService');

// GET /api/wallet/balance
exports.getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('coins totalEarned totalRedeemed');
    res.json({
      success: true,
      data: {
        coins: user.coins,
        totalEarned: user.totalEarned,
        totalRedeemed: user.totalRedeemed,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/wallet/transactions?type=earn&page=1&limit=20
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { userId: req.user._id };
    if (type && ['earn', 'redeem', 'pending'].includes(type)) {
      filter.type = type;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
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

// POST /api/wallet/redeem
exports.redeemCoins = async (req, res, next) => {
  try {
    const { rewardId } = req.body;

    if (!rewardId) {
      return res.status(400).json({ success: false, message: 'Reward ID required' });
    }

    const result = await runWithTransaction(async (session) =>
      atomicRedeem({ session, userId: req.user._id, rewardId })
    );

    if (!result.ok) {
      const status =
        result.code === 'INSUFFICIENT_COINS' || result.code === 'OUT_OF_STOCK' ? 400 : 404;
      return res.status(status).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      message: `Successfully redeemed ${result.reward.title}`,
      data: {
        coins: result.user.coins,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};
