import api from './api';

export interface UserData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  referralCode: string;
  coins: number;
  role: string;
  isNewUser?: boolean;
}

interface SendOTPResponse {
  success: boolean;
  message: string;
  otp?: string; // when API returns it (local dev or EXPOSE_OTP_IN_RESPONSE on host)
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: UserData;
}

interface ApplyReferralResponse {
  success: boolean;
  message: string;
  coins?: number;
}

export const authService = {
  sendOTP: async (phone: string): Promise<SendOTPResponse> => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const response = await api.post<SendOTPResponse>('/auth/send-otp', {
      phone: digits,
    });
    return response.data;
  },

  verifyOTP: async (phone: string, otp: string): Promise<VerifyOTPResponse> => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const response = await api.post<VerifyOTPResponse>('/auth/verify-otp', {
      phone: digits,
      otp,
    });
    return response.data;
  },

  applyReferral: async (referralCode: string): Promise<ApplyReferralResponse> => {
    const response = await api.post<ApplyReferralResponse>('/auth/apply-referral', {
      referralCode,
    });
    return response.data;
  },
};

export default authService;
