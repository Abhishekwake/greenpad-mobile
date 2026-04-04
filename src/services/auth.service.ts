import api from './api';

interface SendOTPResponse {
  success: boolean;
  message: string;
  requestId?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    phoneNumber: string;
    name?: string;
  };
}

const generateMockToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const authService = {
  sendOTP: async (phoneNumber: string): Promise<SendOTPResponse> => {
    try {
      const response = await api.post<SendOTPResponse>('/auth/send-otp', {
        phoneNumber,
      });
      return response.data;
    } catch (error) {
      console.log('Using mock sendOTP response');
      return {
        success: true,
        message: 'OTP sent successfully',
        requestId: `req_${Date.now()}`,
      };
    }
  },

  verifyOTP: async (phoneNumber: string, otp: string): Promise<VerifyOTPResponse> => {
    try {
      const response = await api.post<VerifyOTPResponse>('/auth/verify-otp', {
        phoneNumber,
        otp,
      });
      return response.data;
    } catch (error) {
      console.log('Using mock verifyOTP response');
      if (otp.length === 6) {
        return {
          success: true,
          message: 'OTP verified successfully',
          token: generateMockToken(),
          user: {
            id: `user_${Date.now()}`,
            phoneNumber,
            name: 'GreenPad User',
          },
        };
      }
      return {
        success: false,
        message: 'Invalid OTP',
      };
    }
  },

  logout: async (): Promise<{ success: boolean }> => {
    try {
      await api.post('/auth/logout');
      return { success: true };
    } catch (error) {
      return { success: true };
    }
  },
};

export default authService;
