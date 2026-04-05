import api from './api';

export interface Transaction {
  _id: string;
  type: 'earn' | 'redeem' | 'pending';
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

interface BalanceData {
  coins: number;
  totalEarned: number;
  totalRedeemed: number;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface RedeemResponse {
  success: boolean;
  message: string;
  data?: {
    coins: number;
    transaction: Transaction;
  };
}

export const walletService = {
  getBalance: async (): Promise<BalanceData> => {
    const response = await api.get<{ success: boolean; data: BalanceData }>(
      '/wallet/balance'
    );
    return response.data.data;
  },

  getTransactions: async (
    type?: string,
    page = 1,
    limit = 20
  ): Promise<TransactionsResponse> => {
    const params: Record<string, string | number> = { page, limit };
    if (type) params.type = type;
    const response = await api.get<{ success: boolean; data: TransactionsResponse }>(
      '/wallet/transactions',
      { params }
    );
    return response.data.data;
  },

  redeemReward: async (rewardId: string): Promise<RedeemResponse> => {
    const response = await api.post<RedeemResponse>('/wallet/redeem', {
      rewardId,
    });
    return response.data;
  },
};

export default walletService;
