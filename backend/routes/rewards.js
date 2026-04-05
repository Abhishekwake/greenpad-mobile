const router = require('express').Router();
const Reward = require('../models/Reward');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const rewards = await Reward.find({ isActive: true })
      .sort({ coinsRequired: 1 })
      .lean();

    res.json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
