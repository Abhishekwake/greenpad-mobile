import api from './api';

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalReferralEarnings: number;
  referrals: Array<{
    name: string;
    phone: string;
    joinedAt: string;
  }>;
}

export const referralService = {
  getStats: async (): Promise<ReferralStats> => {
    const response = await api.get<{ success: boolean; data: ReferralStats }>(
      '/referral/stats'
    );
    return response.data.data;
  },
};

export default referralService;
