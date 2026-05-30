const mongoose = require('mongoose');

const mismatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: String,
    storedCoins: Number,
    expectedCoins: Number,
    delta: Number,
  },
  { _id: false }
);

const coinReconciliationRunSchema = new mongoose.Schema(
  {
    ranAt: { type: Date, default: Date.now },
    usersChecked: { type: Number, default: 0 },
    mismatchCount: { type: Number, default: 0 },
    mismatches: [mismatchSchema],
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

coinReconciliationRunSchema.index({ ranAt: -1 });

module.exports = mongoose.model('CoinReconciliationRun', coinReconciliationRunSchema);
