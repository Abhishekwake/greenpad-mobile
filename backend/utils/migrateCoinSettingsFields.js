const AppSettings = require('../models/AppSettings');
const { DEFAULTS } = require('./getCoinSettings');

/** Backfill new AppSettings fields on existing global row. */
async function migrateCoinSettingsFields() {
  const doc = await AppSettings.findOne({ singletonKey: 'global' });
  if (!doc) {
    return;
  }

  const updates = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (key === 'singletonKey') continue;
    if (doc[key] === undefined || doc[key] === null) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length > 0) {
    await AppSettings.updateOne({ singletonKey: 'global' }, { $set: updates });
    console.log(`[migrate] AppSettings backfilled: ${Object.keys(updates).join(', ')}`);
  }
}

module.exports = migrateCoinSettingsFields;
