const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');

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

    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.isActive) {
      return res.status(404).json({ success: false, message: 'Reward not found or inactive' });
    }
    if (reward.stock !== null && reward.stock <= 0) {
      return res.status(400).json({ success: false, message: 'Reward out of stock' });
    }

    const user = await User.findById(req.user._id);
    if (user.coins < reward.coinsRequired) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. You have ${user.coins}, need ${reward.coinsRequired}`,
      });
    }

    user.coins -= reward.coinsRequired;
    user.totalRedeemed += reward.coinsRequired;
    await user.save();

    if (reward.stock !== null) {
      reward.stock -= 1;
      await reward.save();
    }

    const transaction = await Transaction.create({
      userId: user._id,
      type: 'redeem',
      amount: -reward.coinsRequired,
      description: `Redeemed: ${reward.title}`,
      relatedTo: { model: 'Reward', id: reward._id },
      status: 'pending',
    });

    res.json({
      success: true,
      message: `Successfully redeemed ${reward.title}`,
      data: {
        coins: user.coins,
        transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};
