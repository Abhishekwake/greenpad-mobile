import React, { useState, useCallback, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../../constants';
import { rewardService, walletService } from '../../services';
import type { Reward } from '../../services/reward.service';
import { getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores';
import { ErrorRetry } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const CARD_GRADIENTS: string[] = [
  '#ECFDF5',
  '#FEF3C7',
  '#EFF6FF',
  '#FDF2F8',
  '#F5F3FF',
];

interface RewardCardProps {
  item: Reward;
  index: number;
  userCoins: number;
  onRedeem: (reward: Reward) => void;
}

const RewardCard: React.FC<RewardCardProps> = memo(({ item, index, userCoins, onRedeem }) => {
  const canAfford = userCoins >= item.coinsRequired;
  const outOfStock = item.stock !== null && item.stock <= 0;
  const disabled = !canAfford || outOfStock;
  const scale = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = async () => {
    if (disabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (outOfStock) {
        Toast.show({ type: 'info', text1: 'Out of stock', text2: 'This reward is currently unavailable' });
      } else {
        Toast.show({ type: 'info', text1: 'Not enough coins', text2: 'Earn more by referring friends!' });
      }
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRedeem(item);
  };

  const bgColor = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <AnimatedTouchable
        style={[
          styles.card,
          cardStyle,
          { opacity: disabled ? 0.55 : 1 },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: bgColor }]}>
          <Text style={styles.cardIcon}>{item.icon}</Text>
          {item.stock !== null && (
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>
                {item.stock > 0 ? `${item.stock} left` : 'Sold out'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.coinCost}>
            <Text style={styles.coinEmoji}>🪙</Text>
            <Text style={styles.coinValue}>{item.coinsRequired.toLocaleString()}</Text>
          </View>

          <View
            style={[
              styles.redeemBadge,
              canAfford && !outOfStock ? styles.redeemBadgeActive : styles.redeemBadgeDisabled,
            ]}
          >
            <Text
              style={[
                styles.redeemText,
                canAfford && !outOfStock ? styles.redeemTextActive : styles.redeemTextDisabled,
              ]}
            >
              {outOfStock ? 'Sold out' : 'Redeem'}
            </Text>
          </View>
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
});

interface ConfirmModalProps {
  visible: boolean;
  reward: Reward | null;
  userCoins: number;
  isRedeeming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = memo(({
  visible,
  reward,
  userCoins,
  isRedeeming,
  onConfirm,
  onCancel,
}) => {
  if (!reward) return null;

  const afterBalance = userCoins - reward.coinsRequired;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconWrap}>
            <Text style={styles.modalIcon}>{reward.icon}</Text>
          </View>

          <Text style={styles.modalTitle}>{reward.title}</Text>
          <Text style={styles.modalDescription}>{reward.description}</Text>

          <View style={styles.modalDivider} />

          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Cost</Text>
            <Text style={styles.modalValue}>🪙 {reward.coinsRequired.toLocaleString()}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Your balance</Text>
            <Text style={styles.modalValue}>🪙 {userCoins.toLocaleString()}</Text>
          </View>
          <View style={[styles.modalRow, styles.modalRowHighlight]}>
            <Text style={styles.modalLabelBold}>After redemption</Text>
            <Text style={[styles.modalValueBold, { color: afterBalance >= 0 ? COLORS.primary : '#EF4444' }]}>
              🪙 {afterBalance.toLocaleString()}
            </Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isRedeeming}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, isRedeeming && styles.confirmBtnLoading]}
              onPress={onConfirm}
              disabled={isRedeeming}
              activeOpacity={0.8}
            >
              {isRedeeming ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const EmptyState: React.FC = memo(() => (
  <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <Text style={styles.emptyEmoji}>🎁</Text>
    </View>
    <Text style={styles.emptyTitle}>No rewards available</Text>
    <Text style={styles.emptySubtitle}>Check back soon for exciting rewards!</Text>
  </Animated.View>
));

const CoinHeader: React.FC<{ coins: number; animating: boolean }> = memo(({ coins, animating }) => {
  const coinScale = useSharedValue(1);

  useEffect(() => {
    if (animating) {
      coinScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withSpring(1, { damping: 10 })
      );
    }
  }, [animating, coinScale]);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coinScale.value }],
  }));

  return (
    <Animated.View style={[styles.balanceCard, coinStyle]}>
      <View style={styles.balanceDecor}>
        <View style={[styles.decorCircle, styles.dc1]} />
        <View style={[styles.decorCircle, styles.dc2]} />
      </View>
      <Text style={styles.balanceLabel}>Available Coins</Text>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceCoin}>🪙</Text>
        <Text style={styles.balanceAmount}>{coins.toLocaleString()}</Text>
      </View>
    </Animated.View>
  );
});

const RewardsStoreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { userData, updateCoins } = useAuthStore();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCoins, setUserCoins] = useState(userData?.coins ?? 0);

  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [coinAnimating, setCoinAnimating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [rewardsData, balanceData] = await Promise.all([
        rewardService.getRewards(),
        walletService.getBalance(),
      ]);
      setRewards(rewardsData);
      setUserCoins(balanceData.coins);
      updateCoins(balanceData.coins);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [updateCoins]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) fetchData();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleRedeemPress = useCallback((reward: Reward) => {
    setSelectedReward(reward);
    setModalVisible(true);
  }, []);

  const handleCancel = useCallback(() => {
    setModalVisible(false);
    setSelectedReward(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedReward) return;

    setIsRedeeming(true);
    try {
      const response = await walletService.redeemReward(selectedReward._id);

      if (response.success && response.data) {
        setUserCoins(response.data.coins);
        updateCoins(response.data.coins);
        setCoinAnimating(true);
        setTimeout(() => setCoinAnimating(false), 500);

        if (selectedReward.stock !== null) {
          setRewards((prev) =>
            prev.map((r) =>
              r._id === selectedReward._id && r.stock !== null
                ? { ...r, stock: r.stock - 1 }
                : r
            )
          );
        }

        setModalVisible(false);
        setSelectedReward(null);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'Redeemed!',
          text2: `${selectedReward.title} — pending install. We’ll contact you to schedule.`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Redemption failed',
          text2: response.message || 'Please try again',
        });
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      Toast.show({
        type: 'error',
        text1: 'Not enough coins',
        text2: msg.includes('Insufficient') ? 'Earn more by referring friends!' : msg,
      });
    } finally {
      setIsRedeeming(false);
    }
  }, [selectedReward, updateCoins]);

  const renderItem = useCallback(
    ({ item, index }: { item: Reward; index: number }) => (
      <RewardCard
        item={item}
        index={index}
        userCoins={userCoins}
        onRedeem={handleRedeemPress}
      />
    ),
    [userCoins, handleRedeemPress]
  );

  const keyExtractor = useCallback((item: Reward) => item._id, []);

  const ListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        <CoinHeader coins={userCoins} animating={coinAnimating} />
        <Text style={styles.gridTitle}>Available Rewards</Text>
        <Text style={styles.gridSubtitle}>
          {rewards.length} reward{rewards.length !== 1 ? 's' : ''} available
        </Text>
      </View>
    ),
    [userCoins, coinAnimating, rewards.length]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && rewards.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorRetry message={error} onRetry={fetchData} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Rewards Store</Text>
          <Text style={styles.headerSubtitle}>Redeem your GreenCoins</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={rewards}
        numColumns={2}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      <ConfirmModal
        visible={modalVisible}
        reward={selectedReward}
        userCoins={userCoins}
        isRedeeming={isRedeeming}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray[900] },
  headerSubtitle: { fontSize: 12, color: COLORS.gray[500], marginTop: 2 },
  headerSpacer: { width: 40 },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  columnWrapper: {
    gap: 12,
  },
  listHeader: {
    paddingTop: 20,
    paddingBottom: 16,
  },

  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  balanceDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dc1: { width: 130, height: 130, top: -40, right: -30 },
  dc2: { width: 80, height: 80, bottom: -20, left: -20 },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 8,
    zIndex: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  balanceCoin: { fontSize: 36, marginRight: 12 },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1,
  },

  gridTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 13,
    color: COLORS.gray[500],
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardIconWrap: {
    width: '100%',
    height: 80,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: { fontSize: 40 },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: COLORS.gray[500],
    lineHeight: 16,
    marginBottom: 12,
    minHeight: 32,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinCost: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinEmoji: { fontSize: 14, marginRight: 4 },
  coinValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray[900],
  },
  redeemBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  redeemBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  redeemBadgeDisabled: {
    backgroundColor: COLORS.gray[200],
  },
  redeemText: {
    fontSize: 12,
    fontWeight: '700',
  },
  redeemTextActive: {
    color: COLORS.white,
  },
  redeemTextDisabled: {
    color: COLORS.gray[500],
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: { fontSize: 40 },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 6,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.gray[100],
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  modalRowHighlight: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  modalLabel: { fontSize: 14, color: COLORS.gray[500] },
  modalValue: { fontSize: 14, fontWeight: '600', color: COLORS.gray[900] },
  modalLabelBold: { fontSize: 14, fontWeight: '700', color: COLORS.gray[800] },
  modalValueBold: { fontSize: 16, fontWeight: '800' },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmBtnLoading: {
    opacity: 0.8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  },
});

export default RewardsStoreScreen;
