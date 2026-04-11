const mongoose = require('mongoose');

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

module.exports = mongoose.model('Transaction', transactionSchema);
