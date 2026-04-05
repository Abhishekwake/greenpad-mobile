import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  AxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG, STORAGE_KEYS } from '../constants';

let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

const api: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // secure-store unavailable (web preview) – continue without token
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHONE);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
      } catch {
        // ignore
      }
      logoutCallback?.();
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as { message?: string };
      if (data.message) return data.message;
    }
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (error.code === 'ERR_NETWORK') return 'Cannot connect to server. Check your WiFi.';
    if (!error.response) return 'Network error. Check your connection.';
    return `Server error (${error.response.status})`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

interface RetryConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

export async function apiWithRetry<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<AxiosResponse<T>> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408) {
          throw error;
        }
      }
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

export default api;
