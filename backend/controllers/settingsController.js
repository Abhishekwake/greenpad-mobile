const {
  getCoinSettings,
  pickCoinSettings,
  pickSupportSettings,
  pickBrandingSettings,
  pickFeatureSettings,
  pickCompanySettings,
} = require('../utils/getCoinSettings');
const ActivityLog = require('../models/ActivityLog');

exports.getPublicCoinRules = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({ success: true, data: pickCoinSettings(doc) });
  } catch (error) {
    next(error);
  }
};

exports.getPublicContact = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({ success: true, data: pickSupportSettings(doc) });
  } catch (error) {
    next(error);
  }
};

exports.getPublicBranding = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({
      success: true,
      data: {
        ...pickBrandingSettings(doc),
        ...pickFeatureSettings(doc),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPublicFeatures = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({ success: true, data: pickFeatureSettings(doc) });
  } catch (error) {
    next(error);
  }
};

exports.getPublicCompany = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({ success: true, data: pickCompanySettings(doc) });
  } catch (error) {
    next(error);
  }
};

exports.getAdminActivity = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
