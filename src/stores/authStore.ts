import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../constants';
import { setLogoutCallback } from '../services/api';

export interface UserData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  referralCode: string;
  coins: number;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userToken: string | null;
  phoneNumber: string | null;
  userData: UserData | null;
  isInitialized: boolean;
}

interface AuthActions {
  login: (token: string, phone: string, user?: UserData) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setPhoneNumber: (phone: string) => void;
  setUserData: (data: UserData) => void;
  updateCoins: (coins: number) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => {
  setLogoutCallback(() => {
    const { isAuthenticated } = get();
    if (isAuthenticated) {
      set({
        isAuthenticated: false,
        userToken: null,
        phoneNumber: null,
        userData: null,
      });
    }
  });

  return {
    isAuthenticated: false,
    isLoading: false,
    userToken: null,
    phoneNumber: null,
    userData: null,
    isInitialized: false,

    initialize: async () => {
      try {
        set({ isLoading: true });

        const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);
        const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

        let userData: UserData | null = null;
        if (userJson) {
          try {
            userData = JSON.parse(userJson);
          } catch {
            // corrupted data – ignore
          }
        }

        if (token) {
          set({
            isAuthenticated: true,
            userToken: token,
            phoneNumber: phone,
            userData,
            isLoading: false,
            isInitialized: true,
          });
        } else {
          set({
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
        }
      } catch {
        set({
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
      }
    },

    login: async (token: string, phone: string, user?: UserData) => {
      try {
        set({ isLoading: true });

        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_PHONE, phone);
        if (user) {
          await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        }

        set({
          isAuthenticated: true,
          userToken: token,
          phoneNumber: phone,
          userData: user ?? null,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    logout: async () => {
      try {
        set({ isLoading: true });

        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHONE);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);

        set({
          isAuthenticated: false,
          userToken: null,
          phoneNumber: null,
          userData: null,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    setPhoneNumber: (phone: string) => {
      set({ phoneNumber: phone });
    },

    setUserData: (data: UserData) => {
      set({ userData: data });
      SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(data)).catch(() => {});
    },

    updateCoins: (coins: number) => {
      const { userData } = get();
      if (userData) {
        const updated = { ...userData, coins };
        set({ userData: updated });
        SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(updated)).catch(() => {});
      }
    },
  };
});
