const mongoose = require('mongoose');

/** Single-row app configuration (coin economics). */
const appSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'global', unique: true, immutable: true },
    coinsSelfBook: { type: Number, default: 100, min: 0, max: 500000 },
    coinsReferralBook: { type: Number, default: 25, min: 0, max: 500000 },
    coinsLeadVisited: { type: Number, default: 500, min: 0, max: 500000 },
    /** Awarded once when a lead is marked converted without a prior visited step */
    coinsLeadVisitMilestoneOnConvert: { type: Number, default: 500, min: 0, max: 500000 },
    coinsLeadConverted: { type: Number, default: 2000, min: 0, max: 500000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
