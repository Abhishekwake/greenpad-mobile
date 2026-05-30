export { default as api, getErrorMessage, setLogoutCallback } from './api';
export { authService } from './auth.service';
export type { UserData } from './auth.service';
export { userService } from './user.service';
export { walletService } from './wallet.service';
export type { Transaction } from './wallet.service';
export { leadService } from './lead.service';
export type { Lead } from './lead.service';
export { referralService } from './referral.service';
export type { ReferralStats } from './referral.service';
export { rewardService } from './reward.service';
export type { Reward } from './reward.service';
export { notificationService } from './notification.service';
export { videoService } from './video.service';
export type { Video } from './video.service';
export { fetchMyProject, getMyProject } from './project.service';
export type { MyProject, ProjectPhase, ProjectStage, ProjectTask, CustomerView } from './project.service';
export {
  settingsService,
  DEFAULT_COIN_RULES,
  DEFAULT_SUPPORT_CONTACT,
} from './settings.service';
export type { CoinRules, SupportContact } from './settings.service';
