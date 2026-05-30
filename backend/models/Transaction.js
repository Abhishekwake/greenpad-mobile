const mongoose = require('mongoose');

const MILESTONE_TYPE_VALUES = [
  'welcome_bonus',
  'referral_signup_referee',
  'referral_signup_referrer',
  'lead_booking_self',
  'lead_booking_referral',
  'lead_visited',
  'lead_visit_on_convert',
  'lead_converted',
  'lead_booking_clawback',
  'redeem',
];

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'pending'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'cancelled'],
      default: 'completed',
    },
    relatedTo: {
      model: { type: String },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    milestoneType: {
      type: String,
      enum: MILESTONE_TYPE_VALUES,
    },
    /** Set when admin marks a redeem transaction fulfilled */
    fulfilledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index(
  { userId: 1, 'relatedTo.id': 1, milestoneType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'earn',
      milestoneType: { $exists: true, $type: 'string' },
      'relatedTo.id': { $exists: true },
    },
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
