export * from './theme';
export { default as theme } from './theme';

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

/**
 * If nothing else matches, this host is used for physical devices (e.g. LAN IP of your PC).
 * Prefer: EXPO_PUBLIC_API_URL (.env / EAS), then app.json → expo.extra.apiBaseUrl, then dev fallbacks.
 */
const FALLBACK_LAN_HOST = '192.168.1.104';

function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
}

function hostFromExpoDev(): string | null {
  const raw = Constants.expoConfig?.hostUri;
  if (!raw || typeof raw !== 'string') return null;
  const host = raw.includes('://')
    ? (() => {
        try {
          return new URL(raw.startsWith('http') ? raw : `http://${raw}`).hostname;
        } catch {
          return raw.split(':')[0]?.trim() ?? null;
        }
      })()
    : raw.split(':')[0]?.trim() ?? null;
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  // Tunnel / public hosts won’t reach your local API — skip so we can fall back or use extra.
  if (host.endsWith('.exp.direct') || host.includes('ngrok')) return null;
  if (!isPrivateIpv4(host)) return null;
  return host;
}

function isPrivateIpv4(host: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

function resolveApiBaseUrl(): string {
  // Prefer env (EAS secrets / local .env) so you can override app.json `extra.apiBaseUrl` for local API.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return normalizeApiBase(envUrl);
  }

  const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (extraUrl && String(extraUrl).trim().length > 0) {
    return normalizeApiBase(String(extraUrl));
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // Android emulator → host machine
  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:5000/api';
  }

  // iOS Simulator → host machine
  if (Platform.OS === 'ios' && !Device.isDevice) {
    return 'http://127.0.0.1:5000/api';
  }

  const devHost = hostFromExpoDev();
  if (devHost) {
    return `http://${devHost}:5000/api`;
  }

  return `http://${FALLBACK_LAN_HOST}:5000/api`;
}

export const API_CONFIG = {
  BASE_URL: resolveApiBaseUrl(),
  TIMEOUT: 45000,
  RETRY_COUNT: 2,
  RETRY_DELAY: 1500,
};

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(`[GreenPad] API base: ${API_CONFIG.BASE_URL}`);
}

export const OTP_CONFIG = {
  LENGTH: 6,
  RESEND_TIMER: 60,
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'greenpad_auth_token',
  USER_PHONE: 'greenpad_user_phone',
  USER_DATA: 'greenpad_user_data',
};
