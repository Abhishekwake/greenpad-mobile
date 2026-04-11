const AppSettings = require('../models/AppSettings');
const { DEFAULTS } = require('./getCoinSettings');

async function seedCoinSettings() {
  const exists = await AppSettings.exists({ singletonKey: 'global' });
  if (!exists) {
    await AppSettings.create({ ...DEFAULTS });
    console.log('[seed] AppSettings (coin rules) created with defaults');
  }
}

module.exports = seedCoinSettings;
