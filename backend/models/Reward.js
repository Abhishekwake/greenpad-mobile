const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Reward title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Reward description is required'],
    },
    coinsRequired: {
      type: Number,
      required: [true, 'Coins required is mandatory'],
      min: 1,
    },
    icon: {
      type: String,
      default: '🎁',
    },
    stock: {
      type: Number,
      default: null, // null = unlimited
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reward', rewardSchema);
