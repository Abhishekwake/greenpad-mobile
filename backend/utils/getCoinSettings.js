const AppSettings = require('../models/AppSettings');

const DEFAULTS = {
  singletonKey: 'global',
  coinsSelfBook: 100,
  coinsReferralBook: 25,
  coinsLeadVisited: 500,
  coinsLeadVisitMilestoneOnConvert: 500,
  coinsLeadConverted: 2000,
};

/**
 * Returns persisted coin settings (creates default row if missing).
 * @returns {Promise<import('mongoose').Document>}
 */
async function getCoinSettings() {
  let doc = await AppSettings.findOne({ singletonKey: 'global' });
  if (!doc) {
    doc = await AppSettings.create({ ...DEFAULTS });
  }
  return doc;
}

module.exports = { getCoinSettings, DEFAULTS };
