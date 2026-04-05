const mongoose = require('mongoose');
const { generateReferralCode } = require('../utils/generateCode');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^\d{10}$/, 'Phone must be exactly 10 digits'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    referralCode: {
      type: String,
      unique: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    pushToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.referralCode) {
    let code;
    let exists = true;
    while (exists) {
      code = generateReferralCode();
      exists = await mongoose.model('User').findOne({ referralCode: code });
    }
    this.referralCode = code;
  }
});

userSchema.index({ phone: 1 });
userSchema.index({ referralCode: 1 });

module.exports = mongoose.model('User', userSchema);
