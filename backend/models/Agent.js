const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Agent name is required'],
      trim: true,
      maxlength: [120, 'Name too long'],
    },
    role: {
      type: String,
      trim: true,
      maxlength: [80, 'Role too long'],
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone too long'],
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Email too long'],
      default: '',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

agentSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Agent', agentSchema);
