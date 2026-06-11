import api from './api';

export type CoinRules = {
  coinsWelcomeBonus: number;
  coinsReferralSignupReferee: number;
  coinsReferralSignupReferrer: number;
  coinsSelfBook: number;
  coinsReferralBook: number;
  coinsLeadVisited: number;
  coinsLeadVisitMilestoneOnConvert: number;
  coinsLeadConverted: number;
  bookingClawbackHours: number;
  updatedAt?: string;
};

export const DEFAULT_COIN_RULES: CoinRules = {
  coinsWelcomeBonus: 200,
  coinsReferralSignupReferee: 200,
  coinsReferralSignupReferrer: 300,
  coinsSelfBook: 100,
  coinsReferralBook: 25,
  coinsLeadVisited: 500,
  coinsLeadVisitMilestoneOnConvert: 500,
  coinsLeadConverted: 2000,
  bookingClawbackHours: 24,
};

export type SupportContact = {
  supportWhatsApp: string;
  supportPhone: string;
};

export const DEFAULT_SUPPORT_CONTACT: SupportContact = {
  supportWhatsApp: '9999999999',
  supportPhone: '9999999999',
};

export type FeatureFlags = {
  customerDocumentsEnabled: boolean;
  internalDocumentsEnabled: boolean;
  reelsEnabled: boolean;
};

export const settingsService = {
  async getCoinRules(): Promise<CoinRules> {
    const { data } = await api.get<{ success: boolean; data: CoinRules }>('/settings/coin-rules');
    return data.data;
  },

  async getContact(): Promise<SupportContact> {
    const { data } = await api.get<{ success: boolean; data: SupportContact }>('/settings/contact');
    return data.data;
  },

  async getFeatures(): Promise<FeatureFlags> {
    const { data } = await api.get<{ success: boolean; data: FeatureFlags }>('/settings/features');
    return data.data;
  },
};
