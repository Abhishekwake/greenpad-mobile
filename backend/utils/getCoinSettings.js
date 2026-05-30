const AppSettings = require('../models/AppSettings');

const DEFAULTS = {
  singletonKey: 'global',
  coinsWelcomeBonus: 200,
  coinsReferralSignupReferee: 200,
  coinsReferralSignupReferrer: 300,
  coinsSelfBook: 100,
  coinsReferralBook: 25,
  coinsLeadVisited: 500,
  coinsLeadVisitMilestoneOnConvert: 500,
  coinsLeadConverted: 2000,
  bookingClawbackHours: 24,
  supportWhatsApp: '9999999999',
  supportPhone: '9999999999',
};

const COIN_SETTING_KEYS = [
  'coinsWelcomeBonus',
  'coinsReferralSignupReferee',
  'coinsReferralSignupReferrer',
  'coinsSelfBook',
  'coinsReferralBook',
  'coinsLeadVisited',
  'coinsLeadVisitMilestoneOnConvert',
  'coinsLeadConverted',
  'bookingClawbackHours',
];

const SUPPORT_SETTING_KEYS = ['supportWhatsApp', 'supportPhone'];

const ALL_ADMIN_SETTING_KEYS = [...COIN_SETTING_KEYS, ...SUPPORT_SETTING_KEYS];

function pickCoinSettings(doc) {
  return {
    coinsWelcomeBonus: doc.coinsWelcomeBonus,
    coinsReferralSignupReferee: doc.coinsReferralSignupReferee,
    coinsReferralSignupReferrer: doc.coinsReferralSignupReferrer,
    coinsSelfBook: doc.coinsSelfBook,
    coinsReferralBook: doc.coinsReferralBook,
    coinsLeadVisited: doc.coinsLeadVisited,
    coinsLeadVisitMilestoneOnConvert: doc.coinsLeadVisitMilestoneOnConvert,
    coinsLeadConverted: doc.coinsLeadConverted,
    bookingClawbackHours: doc.bookingClawbackHours,
    updatedAt: doc.updatedAt,
  };
}

function pickSupportSettings(doc) {
  return {
    supportWhatsApp: doc.supportWhatsApp,
    supportPhone: doc.supportPhone,
  };
}

function pickAdminSettings(doc) {
  return {
    ...pickCoinSettings(doc),
    ...pickSupportSettings(doc),
  };
}

async function getCoinSettings() {
  let doc = await AppSettings.findOne({ singletonKey: 'global' });
  if (!doc) {
    doc = await AppSettings.create({ ...DEFAULTS });
  }
  return doc;
}

module.exports = {
  getCoinSettings,
  pickCoinSettings,
  pickSupportSettings,
  pickAdminSettings,
  COIN_SETTING_KEYS,
  SUPPORT_SETTING_KEYS,
  ALL_ADMIN_SETTING_KEYS,
  DEFAULTS,
};
