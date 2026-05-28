# Graph Report - .  (2026-05-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 862 nodes · 1357 edges · 67 communities (57 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4c4de23`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 40 edges
2. `COLORS` - 20 edges
3. `useAuthStore` - 20 edges
4. `compilerOptions` - 16 edges
5. `useToast()` - 15 edges
6. `expo` - 14 edges
7. `SIZES` - 11 edges
8. `getErrorMessage()` - 11 edges
9. `Card()` - 10 edges
10. `CardContent()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Sidebar()` --calls--> `cn()`  [EXTRACTED]
  greenpad-admin/src/components/Sidebar.tsx → greenpad-admin/src/lib/utils.ts
- `SplashScreen()` --calls--> `useAuthStore`  [EXTRACTED]
  mobile-app/src/screens/auth/SplashScreen.tsx → mobile-app/src/stores/authStore.ts
- `AgentsPage()` --calls--> `useToast()`  [EXTRACTED]
  greenpad-admin/app/(admin)/agents/page.tsx → greenpad-admin/src/components/ui/toast.tsx
- `LeadsPage()` --calls--> `useToast()`  [EXTRACTED]
  greenpad-admin/app/(admin)/leads/page.tsx → greenpad-admin/src/components/ui/toast.tsx
- `RedemptionsPage()` --calls--> `useToast()`  [EXTRACTED]
  greenpad-admin/app/(admin)/redemptions/page.tsx → greenpad-admin/src/components/ui/toast.tsx

## Communities (67 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (43): dependencies, axios, babel-preset-expo, expo, expo-av, expo-blur, expo-clipboard, expo-constants (+35 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (37): backgroundColor, foregroundImage, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, softwareKeyboardMode (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (36): dependencies, axios, class-variance-authority, clsx, date-fns, @hookform/resolvers, lucide-react, next (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (25): app, { buildCorsOptions }, connectDB, cors, { errorHandler }, express, helmet, limiter (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (27): AgentOption, LeadCRMState, LeadDetailsDrawer(), LeadNote, Props, seedTimeline(), TimelineEntry, StatusBadge() (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): Agent, allowed, AppSettings, c, coins, dayMap, digits, end (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (25): author, dependencies, bcryptjs, cloudinary, cors, dotenv, express, express-rate-limit (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (18): Agent, emptyForm, StatsData, cn(), CoinSettings, FIELDS, Card(), CardContent() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (17): AgentsPage(), LeadsPage(), LoginPage(), RedemptionsPage(), FormValues, Reward, RewardsPage(), schema (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (14): api, token, fulfillmentBadgeClass(), fulfillmentLabel(), downloadCsv(), RedemptionRow, RewardMeta, Tab (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (15): BookingFormValues, BookSiteVisitScreen(), buildDefaultPhone(), buildDefaultValues(), formatDisplayDate(), PROPERTY_OPTIONS, PROPERTY_TYPE_MAP, propertyTypeEnum (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (16): CoinDisplay, CoinDisplayProps, EmptyState, styles, TabBar, TabBarProps, TABS, TabType (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (15): jwt, protect(), User, { protect }, router, { sendOTP, verifyOTP, applyReferral, adminLogin }, { createLead, getMyLeads, rescheduleLead, cancelLead }, { protect } (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (16): AnimatedTouchable, APP_INSTALL_STEPS, EmptyReferrals, ReferActivePath, ReferralCodeCard, ReferralCodeCardProps, ReferralItemUI, ReferralItemUIProps (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (11): ActionItem, ACTIVE_LEAD_STATUSES, AnimatedTouchable, DashboardData, styles, { width: SCREEN_WIDTH }, CreateLeadPayload, CreateLeadResponse (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (14): adminEmail, exposeOtp, { generateOTP, storeOTP, verifyOTP, sendOTPViaSMS }, jwt, otp, result, token, Transaction (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (13): { getCoinSettings }, Lead, legacyToLost, sanitized, Transaction, User, appSettingsSchema, mongoose (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (10): Props, styles, COLORS, FONTS, SHADOWS, SIZES, ButtonProps, styles (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (16): canModify(), formatDate(), LeadCard, LeadCardProps, minSelectableDate(), MyLeadsScreen(), normalizeLeadStatus(), PIPELINE (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (9): NavigationProp, styles, VideoReelRouteProp, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, Stack, Stack, AuthStackParamList, MainStackParamList (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (14): dependencies, greenpad-admin, description, name, private, scripts, admin, admin:build (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (12): AuthStackParamList, LoginScreen(), LoginScreenNavigationProp, Props, styles, ProfileData, ProfileScreen(), styles (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (14): buildType, build, development, preview, production, cli, version, developmentClient (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (5): ErrorBoundary, Props, State, styles, styles

### Community 25 - "Community 25"
Cohesion: 0.21
Nodes (10): DialogContent, DialogHeader(), DialogOverlay, DialogTitle(), TabsContent, TabsList, TabsTrigger, LeadRow (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.23
Nodes (10): HomeScreen(), ICON_MAP, NotificationItem, NotificationsScreen(), styles, RootNavigator(), styles, AppNotification (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.19
Nodes (12): AnimatedTouchable, CARD_GRADIENTS, CoinHeader, ConfirmModal, ConfirmModalProps, EmptyState, RewardCard, RewardCardProps (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (10): ApplyReferralResponse, authService, SendOTPResponse, UserData, VerifyOTPResponse, referralService, ReferralStats, DashboardData (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (9): API_CONFIG, STORAGE_KEYS, api, RetryConfig, setLogoutCallback(), AuthActions, AuthState, AuthStore (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (8): totalReferralEarnings, Transaction, User, mongoose, transactionSchema, { getReferralStats }, { protect }, router

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (7): DotProps, Props, Slide, SlideItemProps, SLIDES, styles, { width: SCREEN_WIDTH }

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (9): Admin (`greenpad-admin/`), Backend (`backend/`), code:block1 (greenpad-app-01/), GreenPad, Install & run, Layout, Mobile app (`mobile-app/`), Prerequisites (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (3): Props, LoadingOverlayProps, styles

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (8): AuthStackParamList, OTPScreen(), OTPScreenNavigationProp, OTPScreenRouteProp, Props, styles, OTP_CONFIG, formatTime()

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (6): cloudinary, VIDEO_METADATA, VIDEO_PUBLIC_IDS, videos, { getVideos }, router

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (7): filter, Reward, Transaction, User, { getBalance, getTransactions, redeemCoins }, { protect }, router

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (7): allowed, Lead, Transaction, updates, User, leadSchema, mongoose

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (5): AuthStackParamList, Props, SplashScreen(), SplashScreenNavigationProp, styles

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (5): geistMono, geistSans, metadata, Providers(), ToastProvider()

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (7): devDependencies, @types/react, typescript, main, name, private, version

### Community 42 - "Community 42"
Cohesion: 0.32
Nodes (5): styles, VideoItemProps, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, Video, videoService

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): requireAdmin(), {
  getStats,
  getLeads,
  updateLeadStatus,
  updateLeadAssign,
  getUsers,
  getUserById,
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  getTransactions,
  getRedemptions,
  updateRedemptionStatus,
  getCoinSettingsAdmin,
  putCoinSettingsAdmin,
  listAgents,
  createAgent,
  updateAgent,
}, { protect }, { requireAdmin }, router

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (4): mongoose, rewardSchema, DEFAULT_REWARDS, Reward

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (5): AnimatedTabIcon(), getTabIcon(), IconName, Tab, MainTabParamList

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (4): { generateReferralCode }, mongoose, userSchema, generateReferralCode()

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (5): code:bash (npm run dev), Deploy on Vercel, Environment, Getting Started, Learn More

### Community 49 - "Community 49"
Cohesion: 0.70
Nodes (4): hostFromExpoDev(), isPrivateIpv4(), normalizeApiBase(), resolveApiBaseUrl()

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (4): code:bash (cd mobile-app), GreenPad Mobile (Expo), Scripts, Setup

### Community 53 - "Community 53"
Cohesion: 0.50
Nodes (3): Button, ButtonProps, buttonVariants

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (3): buildCommand, framework, installCommand

### Community 55 - "Community 55"
Cohesion: 0.50
Nodes (3): compilerOptions, strict, extends

## Knowledge Gaps
- **483 isolated node(s):** `name`, `private`, `description`, `mobile`, `mobile:android` (+478 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `COLORS` connect `Community 18` to `Community 33`, `Community 34`, `Community 39`, `Community 10`, `Community 11`, `Community 45`, `Community 14`, `Community 15`, `Community 19`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 31`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 7` to `Community 4`, `Community 8`, `Community 9`, `Community 53`, `Community 57`, `Community 25`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `useAuthStore` connect `Community 22` to `Community 34`, `Community 39`, `Community 10`, `Community 14`, `Community 15`, `Community 26`, `Community 27`, `Community 29`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `private`, `description` to the rest of the system?**
  _483 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._