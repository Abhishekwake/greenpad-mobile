const Reward = require('../models/Reward');

const DEFAULT_REWARDS = [
  { title: 'Free Maintenance', description: 'One free maintenance visit', coinsRequired: 500, icon: '🔧', stock: null },
  { title: 'Panel Cleaning', description: 'Professional cleaning', coinsRequired: 300, icon: '🧹', stock: null },
  { title: '₹500 Bill Discount', description: 'Off your next bill', coinsRequired: 1000, icon: '💰', stock: 10 },
  { title: 'Monitoring Upgrade', description: 'Smart monitoring system', coinsRequired: 1500, icon: '📊', stock: null },
  { title: 'Referral Boost', description: 'Earn 2x on next 3 referrals', coinsRequired: 2000, icon: '🚀', stock: null },
];

async function seedRewards() {
  const count = await Reward.countDocuments();
  if (count === 0) {
    await Reward.insertMany(DEFAULT_REWARDS);
    console.log(`Seeded ${DEFAULT_REWARDS.length} default rewards`);
  }
}

module.exports = seedRewards;
