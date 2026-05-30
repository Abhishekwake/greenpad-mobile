const { getCoinSettings, pickCoinSettings, pickSupportSettings } = require('../utils/getCoinSettings');

// GET /api/settings/coin-rules — public read-only (mobile app display)
exports.getPublicCoinRules = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({
      success: true,
      data: pickCoinSettings(doc),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/settings/contact — public support numbers for Contact Us
exports.getPublicContact = async (_req, res, next) => {
  try {
    const doc = await getCoinSettings();
    res.json({
      success: true,
      data: pickSupportSettings(doc),
    });
  } catch (error) {
    next(error);
  }
};
