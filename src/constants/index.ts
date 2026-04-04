export * from './theme';
export { default as theme } from './theme';

export const API_CONFIG = {
  BASE_URL: 'https://api.greenpad.com',
  TIMEOUT: 30000,
};

export const OTP_CONFIG = {
  LENGTH: 6,
  RESEND_TIMER: 60,
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'greenpad_auth_token',
  USER_PHONE: 'greenpad_user_phone',
  USER_DATA: 'greenpad_user_data',
};
