import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
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
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { COLORS, SIZES } from '../../constants';
import { referralService } from '../../services';
import type { ReferralStats } from '../../services/referral.service';
import { getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores';
import { ErrorRetry } from '../../components/ui';

/** App-install rewards are separate from referral-site-visit journey. */
const STEPS = [
  { emoji: '📲', title: 'Friend installs with your code (app install bonus)', coins: 200 },
  { emoji: '📅', title: 'You book their site visit — survey completed', coins: 500 },
  { emoji: '✅', title: 'Installation confirmed (solar live)', coins: 2000 },
];

const APP_LINK = 'https://greenpad.app/download';

const getShareMessage = (code: string): string => {
  return `Hey! 👋 Join me on GreenPad and go solar! 🌞\n\nUse my code: ${code} for 200 bonus coins!\n\nDownload: ${APP_LINK}`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
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
  step: (typeof STEPS)[0];
  index: number;
}

const StepItem: React.FC<StepItemProps> = memo(({ step, index }) => (
  <Animated.View
    entering={FadeInDown.delay(400 + index * 100).springify()}
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
            {(referral.name || referral.phone).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.referralInfo}>
          <Text style={styles.referralName}>{referral.name || referral.phone}</Text>
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
  <Animated.View entering={ZoomIn.delay(500)} style={styles.emptyState}>
    <View style={styles.emptyIllustration}>
      <Text style={styles.emptyEmoji}>🤝</Text>
    </View>
    <Text style={styles.emptyTitle}>No referrals yet</Text>
    <Text style={styles.emptySubtitle}>
      Share your code with friends and family to start earning!
    </Text>
  </Animated.View>
));

const ReferScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) fetchStats();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
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

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.container}>
        <ErrorRetry message={error} onRetry={fetchStats} />
      </View>
    );
  }

  const referrals = stats?.referrals ?? [];
  const totalEarned = stats?.totalReferralEarnings ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <Text style={styles.title}>Refer & Earn Rewards</Text>
          <Text style={styles.subtitle}>Share solar with friends, earn together</Text>
        </Animated.View>

        <ReferralCodeCard code={referralCode} onCopy={handleCopyCode} />

        <ShareButton onShare={handleShare} />

        <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.referralBookCard}>
          <View style={styles.referralBookRow}>
            <View style={styles.referralBookIconWrap}>
              <Ionicons name="person-add" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.referralBookTextCol}>
              <Text style={styles.referralBookTitle}>Book site visit for a referred person</Text>
              <Text style={styles.referralBookSubtitle}>
                Same guided steps as your own booking — for someone else. Linked to you for visit &
                installation rewards. Not the same as sharing your install code.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.referralBookBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const parent = navigation.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined;
              parent?.navigate('BookSiteVisit', { mode: 'referral' });
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.referralBookBtnText}>Book for referred person</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsContainer}>
            {STEPS.map((step, index) => (
              <StepItem key={index} step={step} index={index} />
            ))}
          </View>
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerText}>
              Up to <Text style={styles.totalBannerHighlight}>2,700 coins</Text> on the referral visit
              journey (plus separate app-install bonuses)
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(650).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Referrals</Text>
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
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  header: { marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray[500],
  },

  codeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
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
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    top: -40,
    right: -40,
  },
  decorCircle2: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
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
    backgroundColor: COLORS.primary,
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
  referralBookCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  referralBookRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  referralBookIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralBookTextCol: { flex: 1 },
  referralBookTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 6,
  },
  referralBookSubtitle: {
    fontSize: 13,
    color: COLORS.gray[500],
    lineHeight: 19,
  },
  referralBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 16,
  },
  totalEarnedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  totalEarnedText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
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
    backgroundColor: COLORS.gray[50],
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
    color: COLORS.primary,
  },
  stepCoinsLabel: {
    fontSize: 11,
    color: COLORS.gray[400],
    marginTop: 2,
  },
  totalBanner: {
    backgroundColor: '#ECFDF5',
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
    color: COLORS.primary,
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
    backgroundColor: COLORS.primary,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 48 },
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
