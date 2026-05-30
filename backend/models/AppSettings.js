const mongoose = require('mongoose');

/** Single-row app configuration (coin economics). */
const appSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'global', unique: true, immutable: true },
    coinsWelcomeBonus: { type: Number, default: 200, min: 0, max: 500000 },
    coinsReferralSignupReferee: { type: Number, default: 200, min: 0, max: 500000 },
    coinsReferralSignupReferrer: { type: Number, default: 300, min: 0, max: 500000 },
    coinsSelfBook: { type: Number, default: 100, min: 0, max: 500000 },
    coinsReferralBook: { type: Number, default: 25, min: 0, max: 500000 },
    coinsLeadVisited: { type: Number, default: 500, min: 0, max: 500000 },
    /** Awarded once when a lead is marked converted without a prior visited step */
    coinsLeadVisitMilestoneOnConvert: { type: Number, default: 500, min: 0, max: 500000 },
    coinsLeadConverted: { type: Number, default: 2000, min: 0, max: 500000 },
    /** Hours after booking during which cancel may claw back booking coins (also claws back if still pending) */
    bookingClawbackHours: { type: Number, default: 24, min: 1, max: 168 },
    /** 10-digit WhatsApp number for sales (no country code prefix in DB) */
    supportWhatsApp: { type: String, default: '9999999999', match: [/^\d{10}$/, 'Must be 10 digits'] },
    supportPhone: { type: String, default: '9999999999', match: [/^\d{10}$/, 'Must be 10 digits'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
