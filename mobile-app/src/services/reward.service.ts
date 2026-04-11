import api from './api';

export interface Reward {
  _id: string;
  title: string;
  description: string;
  coinsRequired: number;
  icon: string;
  stock: number | null;
  isActive: boolean;
}

export const rewardService = {
  getRewards: async (): Promise<Reward[]> => {
    const response = await api.get<{ success: boolean; data: Reward[] }>(
      '/rewards'
    );
    return response.data.data;
  },
};

export default rewardService;
