const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'GreenPad Ventures' },
    contactEmail: String,
    contactPhone: String,
    address: String,
    logoUrl: String,
    primaryColor: { type: String, default: '#1D9E75' },
    smsNotificationsEnabled: { type: Boolean, default: false },
    emailNotificationsEnabled: { type: Boolean, default: false },
    notifyOnLeadCreated: { type: Boolean, default: true },
    notifyOnLeadConverted: { type: Boolean, default: true },
    notifyOnProjectStageUpdate: { type: Boolean, default: true },
    notifyOnRedemptionRequested: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
