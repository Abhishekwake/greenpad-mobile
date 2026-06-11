import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants';
import { userService, leadService, videoService, settingsService, DEFAULT_SUPPORT_CONTACT } from '../../services';
import { fetchMyProject } from '../../services/project.service';
import type { Lead } from '../../services/lead.service';
import type { Video } from '../../services/video.service';
import { getErrorMessage } from '../../services/api';
import { useAuthStore, useNotificationStore } from '../../stores';
import { ErrorRetry } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

interface ActionItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
  onPress: () => void;
}

interface DashboardData {
  user: {
    name: string;
    phone: string;
    coins: number;
    totalEarned: number;
    totalRedeemed: number;
    referralCode: string;
  };
  stats: {
    totalReferrals: number;
    totalLeads: number;
  };
  recentTransactions: Array<{
    _id: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    createdAt: string;
  }>;
}


const SkeletonBox: React.FC<{ width: number | string; height: number; style?: object }> = ({
  width,
  height,
  style,
}) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: COLORS.gray[200],
          borderRadius: 8,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

const SkeletonLoader: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}>
        <SkeletonBox width={180} height={28} style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
        <SkeletonBox width={40} height={40} style={{ borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)' }} />
      </View>
      <View style={styles.contentContainer}>
        <SkeletonBox width="100%" height={140} style={{ marginBottom: 20, borderRadius: 20 }} />
        <View style={styles.actionGrid}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} width={CARD_WIDTH} height={100} style={{ borderRadius: 16 }} />
          ))}
        </View>
        <SkeletonBox width="100%" height={80} style={{ marginTop: 20, borderRadius: 16 }} />
        <SkeletonBox width={160} height={24} style={{ marginTop: 24, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonBox key={i} width={200} height={150} style={{ borderRadius: 12 }} />
          ))}
        </View>
      </View>
    </View>
  );
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const ActionCard: React.FC<{ item: ActionItem; index: number }> = ({ item, index }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    item.onPress();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={[styles.actionCardWrapper]}
    >
      <AnimatedTouchable
        style={[animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={[styles.actionCard, { backgroundColor: item.gradient[0] }]}>
          <View style={styles.actionIconContainer}>
            <Ionicons name={item.icon} size={28} color={COLORS.white} />
          </View>
          <Text style={styles.actionTitle}>{item.title}</Text>
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const CoinWalletCard: React.FC<{ coins: number; onViewWallet: () => void }> = ({ coins, onViewWallet }) => {
  const [displayCoins, setDisplayCoins] = useState(0);
  const animatedCoins = useSharedValue(0);
  const cardScale = useSharedValue(1);

  useEffect(() => {
    animatedCoins.value = withTiming(coins, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });

    const interval = setInterval(() => {
      const current = Math.round(animatedCoins.value);
      setDisplayCoins(current);
      if (current >= coins) {
        clearInterval(interval);
        setDisplayCoins(coins);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [coins, animatedCoins]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <AnimatedTouchable
        style={[styles.walletCard, cardAnimatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.walletContent}>
          <View style={styles.walletLeft}>
            <Text style={styles.walletLabel}>Your Balance</Text>
            <View style={styles.coinRow}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.coinAmount}>{displayCoins.toLocaleString()}</Text>
              <Text style={styles.coinLabel}>GreenCoins</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewWalletBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewWallet();
            }}
          >
            <Text style={styles.viewWalletText}>View Wallet</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.walletDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const TrustBadge: React.FC = () => (
  <Animated.View entering={FadeInDown.delay(500).springify()}>
    <View style={styles.trustBadge}>
      <View style={styles.trustLogoPlaceholder}>
        <Text style={styles.trustLogoText}>W</Text>
      </View>
      <View style={styles.trustContent}>
        <Text style={styles.trustTitle}>Authorized Waaree Partner</Text>
        <Text style={styles.trustSubtitle}>500+ Happy Customers</Text>
      </View>
      <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
    </View>
  </Animated.View>
);

const VideoCard: React.FC<{
  item: Video;
  index: number;
  onPress: (index: number) => void;
}> = ({ item, index, onPress }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(index);
  };

  return (
    <Animated.View entering={FadeIn.delay(600 + index * 100)}>
      <AnimatedTouchable
        style={[styles.videoCard, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.videoThumbnail}>
          {item.thumbnail ? (
            <Animated.Image
              source={{ uri: item.thumbnail }}
              style={styles.videoThumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="sunny" size={40} color={COLORS.secondary} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={24} color={COLORS.white} />
            </View>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.duration}</Text>
          </View>
          {item.type === 'vertical' && (
            <View style={styles.verticalBadge}>
              <Ionicons name="phone-portrait-outline" size={10} color="#FFF" />
            </View>
          )}
        </View>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.videoLocation} numberOfLines={1}>
          📍 {item.location}
        </Text>
      </AnimatedTouchable>
    </Animated.View>
  );
};

const ACTIVE_LEAD_STATUSES = ['pending', 'contacted', 'visited', 'converted'];

const LEAD_STATUS_LABEL: Record<string, string> = {
  pending: 'Site visit scheduled',
  contacted: 'We will contact you',
  visited: 'Site visit done',
  converted: 'Approved — installation next',
  lost: 'Closed',
};

const LOADING_TIMEOUT = 20000; // 20 seconds max loading time

const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const tabNavigation = useNavigation();
  const stackNavigation = tabNavigation.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [reelsEnabled, setReelsEnabled] = useState(true);
  const [supportContact, setSupportContact] = useState(DEFAULT_SUPPORT_CONTACT);
  const { userData, updateCoins } = useAuthStore();
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { data: activeProject } = useQuery({
    queryKey: ['myProject'],
    queryFn: fetchMyProject,
    staleTime: 60000,
    retry: false,
  });

  const fetchDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setError(null);
        
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          setRefreshing(false);
          setError('Connection is slow. Pull down to retry.');
        }, LOADING_TIMEOUT);
      }

      const [data, leads, videosData, contact, features] = await Promise.all([
        userService.getDashboard(),
        leadService.getMyLeads(),
        videoService.getVideos().catch(() => []),
        settingsService.getContact().catch(() => DEFAULT_SUPPORT_CONTACT),
        settingsService.getFeatures().catch(() => ({ reelsEnabled: true, customerDocumentsEnabled: true, internalDocumentsEnabled: true })),
      ]);
      setSupportContact(contact);
      setReelsEnabled(features?.reelsEnabled !== false);

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      setDashboard(data);
      if (data?.user?.coins != null) {
        updateCoins(data.user.coins);
      }
      setVideos(Array.isArray(videosData) ? videosData : []);
      setError(null);

      const leadsList = Array.isArray(leads) ? leads : [];
      const active = leadsList.find((l) => ACTIVE_LEAD_STATUSES.includes(l.status)) ?? null;
      setActiveLead(active);
    } catch (err) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [updateCoins]);

  const handleVideoPress = useCallback(
    (index: number) => {
      stackNavigation?.navigate('VideoReels', { initialIndex: index });
    },
    [stackNavigation]
  );

  useEffect(() => {
    fetchDashboard();
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [fetchDashboard]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && dashboard) {
        fetchDashboard(false);
      }
    }, [dashboard]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const userName = dashboard?.user?.name || userData?.name || 'User';
  const userCoins = dashboard?.user?.coins ?? userData?.coins ?? 0;

  const navigateToStack = useCallback(
    (screen: keyof MainStackParamList, params?: MainStackParamList[keyof MainStackParamList]) => {
      const parent = tabNavigation.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined;
      if (params !== undefined) {
        parent?.navigate(screen as any, params as any);
      } else {
        parent?.navigate(screen as any);
      }
    },
    [tabNavigation]
  );

  const handleContactUs = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wa = supportContact.supportWhatsApp || DEFAULT_SUPPORT_CONTACT.supportWhatsApp;
    const phone = supportContact.supportPhone || DEFAULT_SUPPORT_CONTACT.supportPhone;
    Alert.alert('Contact GreenPad', 'How would you like to reach our sales team?', [
      {
        text: 'WhatsApp',
        onPress: () => {
          const url = `https://wa.me/91${wa}?text=${encodeURIComponent('Hi GreenPad, I need help with solar.')}`;
          Linking.openURL(url).catch(() => {
            Toast.show({ type: 'error', text1: 'Could not open WhatsApp' });
          });
        },
      },
      {
        text: 'Call',
        onPress: () => {
          Linking.openURL(`tel:+91${phone}`).catch(() => {
            Toast.show({ type: 'error', text1: 'Could not start call' });
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [supportContact]);

  const siteVisitCard: ActionItem = useMemo(() => {
    if (activeProject) {
      return {
        id: '2',
        title: 'Installation',
        icon: 'construct',
        gradient: ['#1D9E75', '#0F766E'],
        onPress: () => navigateToStack('MyProject'),
      };
    }
    if (activeLead) {
      const label = LEAD_STATUS_LABEL[activeLead.status] || 'My site visit';
      return {
        id: '2',
        title: activeLead.status === 'converted' ? 'Installation soon' : label,
        icon: activeLead.status === 'converted' ? 'sunny' : 'checkmark-circle',
        gradient: ['#3B82F6', '#1D4ED8'],
        onPress: () =>
          activeLead.status === 'converted'
            ? navigateToStack('MyProject')
            : navigateToStack('MyLeads'),
      };
    }
    return {
      id: '2',
      title: 'Book Site Visit',
      icon: 'calendar',
      gradient: ['#3B82F6', '#1D4ED8'],
      onPress: () => navigateToStack('BookSiteVisit', { mode: 'self' }),
    };
  }, [activeLead, activeProject, navigateToStack]);

  const actionItems = useMemo<ActionItem[]>(
    () => [
      {
        id: '1',
        title: 'Refer & Earn',
        icon: 'share-social',
        gradient: ['#10B981', '#059669'],
        onPress: () => tabNavigation.navigate('Refer'),
      },
      siteVisitCard,
      {
        id: '3',
        title: 'Rewards Store',
        icon: 'gift',
        gradient: ['#F59E0B', '#D97706'],
        onPress: () => navigateToStack('RewardsStore'),
      },
      {
        id: '4',
        title: 'Contact Us',
        icon: 'chatbubble-ellipses',
        gradient: ['#8B5CF6', '#6D28D9'],
        onPress: handleContactUs,
      },
    ],
    [navigateToStack, tabNavigation, siteVisitCard, handleContactUs]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboard();
  }, [fetchDashboard]);

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const handleNotificationPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigateToStack('Notifications');
  };

  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (error && !dashboard) {
    return (
      <View style={styles.container}>
        <ErrorRetry message={error} onRetry={fetchDashboard} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
            <Text style={styles.subGreeting}>Let's go green today</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={handleNotificationPress}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
        <CoinWalletCard coins={userCoins} onViewWallet={() => tabNavigation.navigate('Wallet')} />

        {activeLead && !activeProject ? (
          <View style={styles.siteVisitBanner}>
            <Ionicons name="information-circle" size={20} color="#1D4ED8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.siteVisitBannerTitle}>
                {dashboard?.siteVisit?.statusLabel ||
                  LEAD_STATUS_LABEL[activeLead.status] ||
                  'Site visit update'}
              </Text>
              <Text style={styles.siteVisitBannerSub}>
                {activeLead.status === 'converted'
                  ? 'Your project will appear here once our team starts tracking on the app.'
                  : 'Log in with this number to follow your visit status anytime.'}
              </Text>
            </View>
          </View>
        ) : null}

        {activeProject && (
          <TouchableOpacity
            style={styles.projectTrackCard}
            onPress={() => navigateToStack('MyProject')}
            activeOpacity={0.85}
          >
            <View style={styles.projectTrackLeft}>
              <View style={styles.projectTrackIcon}>
                <Ionicons name="construct" size={18} color="#1D9E75" />
              </View>
              <View>
                <Text style={styles.projectTrackTitle}>Track installation</Text>
                <Text style={styles.projectTrackSub}>
                  {activeProject.customerView?.currentStage ||
                    activeProject.stages?.find((s) => s.status === 'active')?.name ||
                    'In progress'}
                </Text>
              </View>
            </View>
            <View style={styles.projectTrackBadge}>
              <Text style={styles.projectTrackBadgeText}>Live</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#1D9E75" />
          </TouchableOpacity>
        )}

        <View style={styles.actionGrid}>
          {actionItems.map((item, index) => (
            <ActionCard key={item.id} item={item} index={index} />
          ))}
        </View>

        <TrustBadge />

        {reelsEnabled ? (
          <>
            <Animated.View entering={FadeInDown.delay(550).springify()}>
              <Text style={styles.sectionTitle}>See Real Installations</Text>
            </Animated.View>

            {videos.length > 0 ? (
              <FlatList
                data={videos}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.videoList}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <VideoCard item={item} index={index} onPress={handleVideoPress} />
                )}
              />
            ) : (
              <View style={styles.noVideosContainer}>
                <Ionicons name="videocam-outline" size={32} color={COLORS.gray[400]} />
                <Text style={styles.noVideosText}>Videos coming soon</Text>
              </View>
            )}
          </>
        ) : null}

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
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingBottom: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#059669',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
    marginTop: -40,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: -40,
  },

  walletCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,

    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  walletContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  walletLeft: {},
  walletLabel: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginBottom: 8,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    fontSize: 28,
    marginRight: 8,
  },
  coinAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginRight: 6,
  },
  coinLabel: {
    fontSize: 14,
    color: COLORS.gray[500],
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  viewWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  viewWalletText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 4,
  },
  walletDecoration: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
  },
  decorCircle1: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    right: 0,
    top: 0,
  },
  decorCircle2: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    right: 60,
    top: 50,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCardWrapper: {
    width: CARD_WIDTH,
  },
  actionCard: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  trustLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trustLogoText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  trustSubtitle: {
    fontSize: 12,
    color: COLORS.gray[500],
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 16,
  },
  videoList: {
    paddingRight: 20,
    gap: 12,
  },
  videoCard: {
    width: 200,
    marginRight: 12,
  },
  videoThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray[100],
    marginBottom: 8,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[800],
    lineHeight: 18,
  },
  videoThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  verticalBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoLocation: {
    fontSize: 11,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  noVideosContainer: {
    height: 150,
    backgroundColor: COLORS.gray[100],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noVideosText: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginTop: 8,
  },
  siteVisitBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  siteVisitBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  siteVisitBannerSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    lineHeight: 17,
  },
  projectTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#e8f5f0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c3e8d8',
  },
  projectTrackLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  projectTrackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTrackTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  projectTrackSub: { fontSize: 12, color: '#2d8c5e', marginTop: 1 },
  projectTrackBadge: {
    backgroundColor: '#1D9E75',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  projectTrackBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});

export default HomeScreen;
