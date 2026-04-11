# GreenPad Mobile (Expo)

React Native app for GreenPad — referrals, wallet, leads, and onboarding.

## Setup

```bash
cd mobile-app
npm install
npx expo start
```

Use **Expo Go** or a dev build. Configure the API base URL in `src/constants/index.ts` (and optionally `app.json` → `expo.extra.apiBaseUrl`) so the device can reach your `backend/` server.

## Scripts

- `npm start` — Expo dev server  
- `npm run android` / `npm run ios` / `npm run web` — platform targets  

EAS config lives in `eas.json` in this folder.
