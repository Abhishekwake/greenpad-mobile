import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../constants';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userToken: string | null;
  phoneNumber: string | null;
  isInitialized: boolean;
}

interface AuthActions {
  login: (token: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setPhoneNumber: (phone: string) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  userToken: null,
  phoneNumber: null,
  isInitialized: false,

  initialize: async () => {
    try {
      set({ isLoading: true });
      
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);
      
      if (token) {
        set({
          isAuthenticated: true,
          userToken: token,
          phoneNumber: phone,
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
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  login: async (token: string, phone: string) => {
    try {
      set({ isLoading: true });
      
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_PHONE, phone);
      
      set({
        isAuthenticated: true,
        userToken: token,
        phoneNumber: phone,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error during login:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHONE);
      
      set({
        isAuthenticated: false,
        userToken: null,
        phoneNumber: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error during logout:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  setPhoneNumber: (phone: string) => {
    set({ phoneNumber: phone });
  },
}));
