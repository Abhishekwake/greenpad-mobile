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
  companyLegalName: 'GreenPad Ventures',
  companyAddress: '',
  companyGst: '',
  companyEmail: '',
  companyWebsite: '',
  brandDisplayName: 'GreenPad',
  brandPrimaryColor: '#059669',
  brandLogoUrl: '',
  notifyLeadStatusPush: true,
  notifyProjectStagePush: true,
  notifyCoinRedemptionPush: true,
  customerDocumentsEnabled: true,
  internalDocumentsEnabled: true,
  reelsEnabled: true,
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

const ALL_ADMIN_SETTING_KEYS = [
  ...COIN_SETTING_KEYS,
  ...SUPPORT_SETTING_KEYS,
  'companyLegalName',
  'companyAddress',
  'companyGst',
  'companyEmail',
  'companyWebsite',
  'brandDisplayName',
  'brandPrimaryColor',
  'brandLogoUrl',
  'notifyLeadStatusPush',
  'notifyProjectStagePush',
  'notifyCoinRedemptionPush',
  'customerDocumentsEnabled',
  'internalDocumentsEnabled',
  'reelsEnabled',
];

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

function pickFeatureSettings(doc) {
  return {
    customerDocumentsEnabled: doc.customerDocumentsEnabled ?? true,
    internalDocumentsEnabled: doc.internalDocumentsEnabled ?? true,
    reelsEnabled: doc.reelsEnabled ?? true,
  };
}

function pickBrandingSettings(doc) {
  return {
    brandDisplayName: doc.brandDisplayName || 'GreenPad',
    brandPrimaryColor: doc.brandPrimaryColor || '#059669',
    brandLogoUrl: doc.brandLogoUrl || '',
  };
}

function pickCompanySettings(doc) {
  return {
    companyLegalName: doc.companyLegalName || '',
    companyAddress: doc.companyAddress || '',
    companyGst: doc.companyGst || '',
    companyEmail: doc.companyEmail || '',
    companyWebsite: doc.companyWebsite || '',
  };
}

function pickNotificationSettings(doc) {
  return {
    notifyLeadStatusPush: doc.notifyLeadStatusPush ?? true,
    notifyProjectStagePush: doc.notifyProjectStagePush ?? true,
    notifyCoinRedemptionPush: doc.notifyCoinRedemptionPush ?? true,
  };
}

function pickAdminSettings(doc) {
  return {
    ...pickCoinSettings(doc),
    ...pickSupportSettings(doc),
    ...pickCompanySettings(doc),
    ...pickBrandingSettings(doc),
    ...pickNotificationSettings(doc),
    ...pickFeatureSettings(doc),
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
  pickFeatureSettings,
  pickBrandingSettings,
  pickCompanySettings,
  pickNotificationSettings,
  COIN_SETTING_KEYS,
  SUPPORT_SETTING_KEYS,
  ALL_ADMIN_SETTING_KEYS,
  DEFAULTS,
};
