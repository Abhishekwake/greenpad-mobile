import React, { useState, useCallback, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Platform,
  Linking,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants';
import { referralService } from '../../services';
import type { ReferralStats } from '../../services/referral.service';
import { getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores';
import { ErrorRetry } from '../../components/ui';

/** Refer tab header / accents (purple theme). */
const REFER_HEADER_BG = '#5B21B6';
const REFER_ACCENT = '#7C3AED';
const REFER_SOFT = '#EDE9FE';
const REFER_SOFT_BORDER = 'rgba(124, 58, 237, 0.35)';

type RewardStep = { emoji: string; title: string; coins: number };

/** Coins when you book a lead for someone else (backend createLead referral). */
const SITE_VISIT_REFERRAL_STEPS: RewardStep[] = [
  { emoji: '📝', title: 'Form filled for your referral', coins: 25 },
  { emoji: '📅', title: 'Their home visit is done', coins: 500 },
  { emoji: '✅', title: 'Solar installation complete', coins: 2000 },
];

/** App install only — not mixed with site-visit referral rewards. */
const APP_INSTALL_STEPS: RewardStep[] = [
  { emoji: '📲', title: 'They install using your code', coins: 200 },
];

const APP_LINK = 'https://greenpad.app/download';

const getShareMessage = (code: string): string => {
  return `Hey! 👋 Join me on GreenPad and go solar! 🌞\n\nUse my code: ${code} for 200 bonus coins!\n\nDownload: ${APP_LINK}`;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

type ReferralStatus = 'Signed up' | 'Visited' | 'Converted';

const getStatusColor = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'Converted':
      return { bg: '#ECFDF5', text: COLORS.primary };
    case 'Visited':
      return { bg: '#FEF3C7', text: '#D97706' };
    case 'Signed up':
    default:
      return { bg: '#EFF6FF', text: '#3B82F6' };
  }
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ReferralCodeCardProps {
  code: string;
  onCopy: () => void;
}

const ReferralCodeCard: React.FC<ReferralCodeCardProps> = memo(({ code, onCopy }) => {
  const copyScale = useSharedValue(1);

  const copyButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: copyScale.value }],
  }));

  const handleCopy = async () => {
    copyScale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withSpring(1, { damping: 15 })
    );
    onCopy();
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.codeCard}>
      <View style={styles.codeCardDecor}>
        <View style={[styles.decorCircle, styles.decorCircle1]} />
        <View style={[styles.decorCircle, styles.decorCircle2]} />
      </View>

      <Text style={styles.codeLabel}>Your Referral Code</Text>

      <View style={styles.codeContainer}>
        <Text style={styles.codeText}>{code}</Text>
      </View>

      <AnimatedTouchable
        style={[styles.copyButton, copyButtonStyle]}
        onPress={handleCopy}
        activeOpacity={0.8}
      >
        <Ionicons name="copy-outline" size={20} color={COLORS.white} />
        <Text style={styles.copyButtonText}>Copy Code</Text>
      </AnimatedTouchable>
    </Animated.View>
  );
});

interface ShareButtonProps {
  onShare: () => void;
}

const ShareButton: React.FC<ShareButtonProps> = memo(({ onShare }) => {
  const scale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(300).springify()}>
      <AnimatedTouchable
        style={[styles.shareButton, buttonStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onShare}
        activeOpacity={1}
      >
        <Ionicons name="logo-whatsapp" size={24} color={COLORS.white} />
        <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
      </AnimatedTouchable>

      <TouchableOpacity style={styles.otherShareButton} onPress={onShare}>
        <Ionicons name="share-social-outline" size={18} color={COLORS.gray[600]} />
        <Text style={styles.otherShareText}>Other sharing options</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

interface StepItemProps {
  step: RewardStep;
  index: number;
  baseDelay?: number;
}

const StepItem: React.FC<StepItemProps> = memo(({ step, index, baseDelay = 400 }) => (
  <Animated.View
    entering={FadeInDown.delay(baseDelay + index * 100).springify()}
    style={styles.stepItem}
  >
    <View style={styles.stepLeft}>
      <View style={styles.stepEmoji}>
        <Text style={styles.stepEmojiText}>{step.emoji}</Text>
      </View>
      <Text style={styles.stepTitle}>{step.title}</Text>
    </View>
    <View style={styles.stepCoins}>
      <Text style={styles.stepCoinsText}>+{step.coins.toLocaleString()}</Text>
      <Text style={styles.stepCoinsLabel}>coins</Text>
    </View>
  </Animated.View>
));

interface ReferralItemUIProps {
  referral: { name: string; phone: string; joinedAt: string };
  index: number;
}

const ReferralItemUI: React.FC<ReferralItemUIProps> = memo(({ referral, index }) => {
  const statusColors = getStatusColor('Signed up');

  return (
    <Animated.View
      entering={FadeInDown.delay(700 + index * 80).springify()}
      style={styles.referralItem}
    >
      <View style={styles.referralLeft}>
        <View style={styles.referralAvatar}>
          <Text style={styles.referralAvatarText}>
            {(referral.name || referral.phone || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.referralInfo}>
          <Text style={styles.referralName}>{referral.name || referral.phone || 'Friend'}</Text>
          <Text style={styles.referralDate}>{formatDate(referral.joinedAt)}</Text>
        </View>
      </View>

      <View style={styles.referralRight}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>Signed up</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const EmptyReferrals: React.FC = memo(() => (
  <Animated.View entering={ZoomIn.delay(200)} style={styles.emptyState}>
    <View style={styles.emptyIllustration}>
      <Ionicons name="people-outline" size={40} color={COLORS.gray[400]} />
    </View>
    <Text style={styles.emptyTitle}>No installs yet</Text>
    <Text style={styles.emptySubtitle}>Share your code above to invite friends.</Text>
  </Animated.View>
));

type ReferActivePath = 'hub' | 'site_visit' | 'app_install';

const ReferScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activePath, setActivePath] = useState<ReferActivePath>('hub');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const { userData } = useAuthStore();

  const referralCode = stats?.referralCode || userData?.referralCode || '------';

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const data = await referralService.getStats();
      setStats(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const goBackToHub = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePath('hub');
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) fetchStats();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Android hardware back: return to two-option hub instead of leaving Refer / jumping to Home tab. */
  useFocusEffect(
    useCallback(() => {
      if (activePath === 'hub') {
        return undefined;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        void goBackToHub();
        return true;
      });
      return () => sub.remove();
    }, [activePath, goBackToHub])
  );

  const handleCopyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(referralCode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Copied!', text2: 'Referral code copied to clipboard' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to copy' });
    }
  }, [referralCode]);

  const handleShare = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const message = getShareMessage(referralCode);
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return;
      }
    } catch {
      // WhatsApp not available
    }

    try {
      await Share.share({ message, title: 'Join GreenPad' });
    } catch {
      // share cancelled or failed
    }
  }, [referralCode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchStats();
  }, [fetchStats]);

  const goBookReferralVisit = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parent = navigation.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined;
    parent?.navigate('BookSiteVisit', { mode: 'referral' });
  }, [navigation]);

  const goMyLeads = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const parent = navigation.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined;
    parent?.navigate('MyLeads');
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerDecor}>
            <View style={[styles.hDecorCircle, styles.hDecorCircle1]} />
            <View style={[styles.hDecorCircle, styles.hDecorCircle2]} />
          </View>
          <Text style={styles.greeting}>Refer & earn</Text>
        </View>
        <View style={[styles.loadingBody, { paddingTop: insets.top + 120 }]}>
          <ActivityIndicator size="large" color={REFER_ACCENT} />
        </View>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerDecor}>
            <View style={[styles.hDecorCircle, styles.hDecorCircle1]} />
            <View style={[styles.hDecorCircle, styles.hDecorCircle2]} />
          </View>
          <Text style={styles.greeting}>Refer & earn</Text>
        </View>
        <View style={styles.errorBody}>
          <ErrorRetry message={error} onRetry={fetchStats} />
        </View>
      </View>
    );
  }

  const referrals = stats?.referrals ?? [];
  const totalEarned = stats?.totalReferralEarnings ?? 0;

  const siteVisitMaxCoins =
    SITE_VISIT_REFERRAL_STEPS.reduce((s, x) => s + x.coins, 0) || 0;

  const renderHub = () => (
    <>
      <Animated.View entering={FadeIn.delay(120).duration(400)}>
        <TouchableOpacity
          style={[styles.pathChoiceCard, styles.pathChoiceCardPrimary]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setActivePath('site_visit');
          }}
          activeOpacity={0.92}
        >
          <View style={styles.pathChoiceAccent} />
          <View style={styles.pathChoiceIconWrap}>
            <Ionicons name="calendar" size={24} color={REFER_ACCENT} />
          </View>
          <View style={styles.pathChoiceTextCol}>
            <Text style={styles.pathChoiceBadge}>For someone you know</Text>
            <Text style={styles.pathChoiceTitle}>Book a visit for them</Text>
            <Text style={styles.pathChoiceSubtitle}>
              You fill the form · Linked to you · Check status anytime
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pathChoiceCard}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActivePath('app_install');
          }}
          activeOpacity={0.92}
        >
          <View style={[styles.pathChoiceIconWrap, styles.pathChoiceIconWrapMuted]}>
            <Ionicons name="share-social-outline" size={24} color={REFER_ACCENT} />
          </View>
          <View style={styles.pathChoiceTextCol}>
            <Text style={styles.pathChoiceTitle}>Share the app</Text>
            <Text style={styles.pathChoiceSubtitle}>Code & link · WhatsApp · Small reward per install</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  const renderSiteVisitPath = () => (
    <>
      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.surfaceCard}>
        <Text style={styles.surfaceTitle}>What this is</Text>
        <Text style={[styles.surfaceBody, styles.surfaceBodySolo]}>
          Fill out the visit booking for a friend or family member. It stays on your account. You earn
          coins step by step — from sending the form to when their solar is fully installed.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.section}>
        <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>How you earn</Text>
        <View style={styles.stepsContainer}>
          {SITE_VISIT_REFERRAL_STEPS.map((step, index) => (
            <StepItem key={index} step={step} index={index} baseDelay={160} />
          ))}
        </View>
        <View style={styles.totalBanner}>
          <Text style={styles.totalBannerText}>
            Up to{' '}
            <Text style={styles.totalBannerHighlight}>{siteVisitMaxCoins.toLocaleString()} coins</Text> when
            all milestones complete
          </Text>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.referralBookBtn} onPress={goBookReferralVisit} activeOpacity={0.9}>
        <Text style={styles.referralBookBtnText}>Start booking</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={styles.btnIconAfter} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={goMyLeads} activeOpacity={0.9}>
        <Ionicons name="list-outline" size={20} color={REFER_ACCENT} />
        <Text style={[styles.secondaryBtnText, styles.secondaryBtnTextAfter]}>My visits</Text>
      </TouchableOpacity>
    </>
  );

  const renderAppInstallPath = () => (
    <>
      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.surfaceCard}>
        <Text style={styles.surfaceTitle}>What this is</Text>
        <Text style={styles.surfaceBody}>
          Send your code. When someone installs GreenPad and signs up with your code, you get the install
          reward.
        </Text>
        <Text style={styles.surfaceFine}>
          Want to book a visit for someone else? Go back and tap Book a visit for them.
        </Text>
      </Animated.View>

      <ReferralCodeCard code={referralCode} onCopy={handleCopyCode} />
      <ShareButton onShare={handleShare} />

      <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.section}>
        <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Install reward</Text>
        <View style={styles.stepsContainer}>
          {APP_INSTALL_STEPS.map((step, index) => (
            <StepItem key={index} step={step} index={index} baseDelay={200} />
          ))}
        </View>
        <View style={[styles.totalBanner, styles.totalBannerMuted]}>
          <Text style={styles.totalBannerText}>
            Bigger rewards are on the other option:{' '}
            <Text style={styles.totalBannerHighlight}>Book a visit for them</Text> on the first screen.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Joined with your code</Text>
          {referrals.length > 0 && (
            <View style={styles.totalEarnedBadge}>
              <Text style={styles.totalEarnedText}>+{totalEarned.toLocaleString()} 🪙</Text>
            </View>
          )}
        </View>

        {referrals.length > 0 ? (
          <View style={styles.referralsList}>
            {referrals.map((referral, index) => (
              <ReferralItemUI key={index} referral={referral} index={index} />
            ))}
          </View>
        ) : (
          <EmptyReferrals />
        )}
      </Animated.View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerDecor}>
          <View style={[styles.hDecorCircle, styles.hDecorCircle1]} />
          <View style={[styles.hDecorCircle, styles.hDecorCircle2]} />
          <View style={[styles.hDecorCircle, styles.hDecorCircle3]} />
        </View>
        {activePath === 'hub' ? (
          <View>
            <Text style={styles.greeting}>Refer & earn</Text>
            <Text style={styles.subGreeting}>Pick one — both are simple</Text>
          </View>
        ) : (
          <View style={styles.headerDetailRow}>
            <TouchableOpacity style={styles.headerBackBtn} onPress={goBackToHub} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={26} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.headerDetailTitles}>
              <Text style={styles.greeting}>
                {activePath === 'site_visit' ? 'Book for them' : 'Share app'}
              </Text>
              <Text style={styles.subGreeting}>
                {activePath === 'site_visit' ? 'Form for your referral' : 'Your code & link'}
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={REFER_ACCENT}
            colors={[REFER_ACCENT]}
          />
        }
      >
        {activePath === 'hub' && renderHub()}
        {activePath === 'site_visit' && renderSiteVisitPath()}
        {activePath === 'app_install' && renderAppInstallPath()}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  headerGradient: {
    backgroundColor: REFER_HEADER_BG,
    paddingHorizontal: 20,
    paddingBottom: 56,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  hDecorCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  hDecorCircle1: { width: 140, height: 140, top: -50, right: -40 },
  hDecorCircle2: { width: 90, height: 90, bottom: -10, left: -20 },
  hDecorCircle3: { width: 56, height: 56, top: 28, left: '42%' },

  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  headerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerDetailTitles: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
    marginTop: -36,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  loadingBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBody: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  surfaceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  surfaceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 10,
  },
  surfaceBody: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.gray[700],
    lineHeight: 23,
    marginBottom: 10,
  },
  surfaceFine: {
    fontSize: 14,
    color: COLORS.gray[600],
    lineHeight: 21,
    marginTop: 4,
  },
  surfaceBodySolo: {
    marginBottom: 0,
  },

  pathChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    overflow: 'hidden',
    position: 'relative',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  pathChoiceCardPrimary: {
    borderColor: REFER_SOFT_BORDER,
  },
  pathChoiceAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: REFER_ACCENT,
  },
  pathChoiceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: REFER_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 14,
  },
  pathChoiceIconWrapMuted: {
    backgroundColor: COLORS.gray[50],
  },
  pathChoiceTextCol: {
    flex: 1,
    marginRight: 8,
  },
  pathChoiceBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: REFER_ACCENT,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pathChoiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  pathChoiceSubtitle: {
    fontSize: 13,
    color: COLORS.gray[500],
    lineHeight: 18,
  },

  sectionTitleTight: {
    marginBottom: 12,
  },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: REFER_ACCENT,
    backgroundColor: COLORS.white,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: REFER_ACCENT,
  },
  secondaryBtnTextAfter: {
    marginLeft: 8,
  },
  btnIconAfter: {
    marginLeft: 8,
  },

  totalBannerMuted: {
    backgroundColor: COLORS.gray[50],
  },

  codeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  codeCardDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
  },
  decorCircle1: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    top: -40,
    right: -40,
  },
  decorCircle2: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(91, 33, 182, 0.1)',
    bottom: -30,
    left: -30,
  },
  codeLabel: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginBottom: 12,
    zIndex: 1,
  },
  codeContainer: {
    backgroundColor: COLORS.gray[50],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray[100],
    borderStyle: 'dashed',
    marginBottom: 20,
    zIndex: 1,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.gray[900],
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: REFER_ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    zIndex: 1,
  },
  copyButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  referralBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REFER_ACCENT,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 6,
    shadowColor: REFER_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  referralBookBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  otherShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  otherShareText: {
    color: COLORS.gray[500],
    fontSize: 14,
    marginLeft: 6,
  },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 16,
  },
  totalEarnedBadge: {
    backgroundColor: REFER_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  totalEarnedText: {
    fontSize: 14,
    fontWeight: '700',
    color: REFER_ACCENT,
  },

  stepsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: REFER_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepEmojiText: { fontSize: 22 },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[800],
    flex: 1,
  },
  stepCoins: { alignItems: 'flex-end' },
  stepCoinsText: {
    fontSize: 18,
    fontWeight: '800',
    color: REFER_ACCENT,
  },
  stepCoinsLabel: {
    fontSize: 11,
    color: COLORS.gray[400],
    marginTop: 2,
  },
  totalBanner: {
    backgroundColor: REFER_SOFT,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  totalBannerText: {
    fontSize: 15,
    color: COLORS.gray[700],
  },
  totalBannerHighlight: {
    fontWeight: '800',
    color: REFER_ACCENT,
  },

  referralsList: { gap: 12 },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  referralLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: REFER_ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  referralInfo: {},
  referralName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 12,
    color: COLORS.gray[400],
  },
  referralRight: { alignItems: 'flex-end' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  emptyIllustration: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ReferScreen;
