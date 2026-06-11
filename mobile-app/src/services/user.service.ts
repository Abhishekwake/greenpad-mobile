import api from './api';

interface DashboardData {
  user: {
    name: string;
    phone: string;
    coins: number;
    totalEarned: number;
    totalRedeemed: number;
    referralCode: string;
  };
  stats: {
    totalReferrals: number;
    totalLeads: number;
  };
  siteVisit?: {
    leadId: string;
    status: string;
    statusLabel: string;
    preferredDate?: string;
    timeSlot?: string;
    source?: string;
  } | null;
  project?: {
    status: string;
    hasProject: boolean;
  } | null;
  recentTransactions: Array<{
    _id: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    createdAt: string;
  }>;
}

interface ProfileData {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  referralCode: string;
  coins: number;
  totalEarned: number;
  totalRedeemed: number;
  role: string;
  createdAt: string;
}

export const userService = {
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<{ success: boolean; data: DashboardData }>(
      '/user/dashboard'
    );
    return response.data.data;
  },

  getProfile: async (): Promise<ProfileData> => {
    const response = await api.get<{ success: boolean; data: ProfileData }>(
      '/user/profile'
    );
    return response.data.data;
  },

  updateProfile: async (updates: { name?: string; email?: string }): Promise<ProfileData> => {
    const response = await api.put<{ success: boolean; data: ProfileData }>(
      '/user/profile',
      updates
    );
    return response.data.data;
  },
};

export default userService;
