# GreenPad

Monorepo for the GreenPad solar referral product: **mobile app** (Expo), **admin dashboard** (Next.js), and **API** (Node/Express/MongoDB).

## Layout

```
greenpad-app-01/
├── mobile-app/      # React Native + Expo (user app)
├── greenpad-admin/  # Next.js (internal CRM / admin)
└── backend/         # Express REST API + MongoDB
```

## Prerequisites

- Node.js 20+ recommended  
- MongoDB for `backend/`  
- For physical devices: set API URL in `mobile-app` (see `mobile-app/src/constants/index.ts` and `app.json` extras).

## Install & run

From the **repository root**:

| Area | Command | Notes |
|------|---------|--------|
| Mobile | `cd mobile-app && npm install && npx expo start` | Or `npm run mobile` from root after installing deps in `mobile-app`. |
| Admin | `cd greenpad-admin && npm install && npm run dev` | `NEXT_PUBLIC_API_URL` from committed `.env.development`; override with `.env.local`. Production: `.env.production` or host env. |
| API | `cd backend && npm install && npm run dev` | Or `npm run api` from root. |

Root `package.json` scripts use `npm run … --prefix <folder>` so you can run `npm run mobile` **after** each package has been `npm install`’d once in its own directory.

## Mobile app (`mobile-app/`)

- Expo SDK 54, React Navigation, Zustand, SecureStore.  
- See `mobile-app/README.md` for app-specific notes.

## Admin (`greenpad-admin/`)

- Central client: **`src/lib/api.ts`** (Axios `baseURL` = `process.env.NEXT_PUBLIC_API_URL` only).
  - **`next dev`:** values from **`.env.development`** (committed default). Override with **`.env.local`**.
  - **Production:** set **`NEXT_PUBLIC_API_URL`** in `.env.production` or the host (see `greenpad-admin/.env.production.example`).

## Backend (`backend/`)

- **Development:** copy `backend/.env.example` → `backend/.env` and configure `MONGODB_URI`, `JWT_SECRET`, etc. Run with `npm run dev` (loads `.env`, `NODE_ENV=development`).
- **Production:** copy `backend/.env.production.example` → `backend/.env.production` on the server, or inject the same variables via your platform. Run with `npm start` (loads `.env.production`, `NODE_ENV=production`).

## Theme (mobile)

- Primary: `#10B981` · Secondary: `#F59E0B` · Background: `#F9FAFB`
