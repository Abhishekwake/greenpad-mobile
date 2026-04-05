export * from './theme';
export { default as theme } from './theme';

// Use your PC's local WiFi IP so both emulators and real devices can connect.
// Change this if your IP changes.
const DEV_HOST = '192.168.1.104';

export const API_CONFIG = {
  BASE_URL: `http://${DEV_HOST}:5000/api`,
  TIMEOUT: 45000, // Increased for slower devices
  RETRY_COUNT: 2,
  RETRY_DELAY: 1500,
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
