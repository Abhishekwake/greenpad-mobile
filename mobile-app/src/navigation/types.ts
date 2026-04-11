import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string; devOtp?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Wallet: undefined;
  Refer: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  BookSiteVisit: { mode?: 'self' | 'referral' } | undefined;
  RewardsStore: undefined;
  Notifications: undefined;
  MyLeads: undefined;
  VideoReels: { initialIndex: number };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AuthStackParamList, MainTabParamList, MainStackParamList {}
  }
}
