# GreenPad - Solar Referral Rewards App

A React Native Expo app for solar referral rewards.

## Project Structure

```
src/
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── index.ts
├── constants/
│   ├── theme.ts          # Colors, sizes, shadows
│   └── index.ts          # API config, storage keys
├── navigation/
│   ├── AuthNavigator.tsx # Splash → Login → OTP
│   ├── MainNavigator.tsx # Bottom tabs (Home, Wallet, Refer, Profile)
│   ├── RootNavigator.tsx # Conditional auth/main navigation
│   └── types.ts          # TypeScript navigation types
├── screens/
│   ├── auth/
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   └── OTPScreen.tsx
│   └── main/
│       ├── HomeScreen.tsx
│       ├── WalletScreen.tsx
│       ├── ReferScreen.tsx
│       └── ProfileScreen.tsx
├── services/
│   ├── api.ts            # Axios instance with interceptors
│   └── auth.service.ts   # sendOTP, verifyOTP
└── stores/
    └── authStore.ts      # Zustand store with secure storage
```

## Theme Colors

- **Primary**: `#10B981` (Green)
- **Secondary**: `#F59E0B` (Amber)
- **Background**: `#F9FAFB` (Light gray)

## Features

### Authentication
- Phone number input with +91 format
- 10-digit validation
- 6-box OTP input with auto-focus
- 60-second resend timer
- Mock OTP accepts any 6 digits
- Token persistence with expo-secure-store

### Navigation
- Auth flow: Splash → Login → OTP
- Main tabs: Home, Wallet, Refer, Profile
- Conditional navigation based on auth state
- Ionicons for tab icons

### API Layer
- Axios instance with base URL
- Automatic token injection via interceptors
- Mock responses for development

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios
```

## Testing Authentication Flow

1. App launches with animated splash screen (2 seconds)
2. Login screen appears with phone input
3. Enter any 10-digit number (e.g., 9876543210)
4. OTP screen appears with 6 input boxes
5. Enter any 6 digits to verify
6. Bottom tabs appear (Home, Wallet, Refer, Profile)
7. Go to Profile tab and tap Logout
8. Returns to Login screen with cleared token

## Dependencies

- expo ~54.0.0
- react-native
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/bottom-tabs
- zustand
- expo-secure-store
- expo-linear-gradient
- axios
- @expo/vector-icons
