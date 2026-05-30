const mongoose = require('mongoose');

const adminAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    adminRole: {
      type: String,
      enum: ['super_admin', 'ops'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

adminAccountSchema.index({ email: 1 });
adminAccountSchema.index({ adminRole: 1, isActive: 1 });

module.exports = mongoose.model('AdminAccount', adminAccountSchema);
