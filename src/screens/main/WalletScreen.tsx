import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, SIZES } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TransactionType = 'earn' | 'redeem';
type TransactionStatus = 'completed' | 'pending';
type TabType = 'all' | 'earned' | 'redeemed' | 'pending';

interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  status: TransactionStatus;
}

const TRANSACTIONS: Transaction[] = [
  { id: 1, type: 'earn', amount: 200, description: 'Welcome bonus', date: '2024-04-01', status: 'completed' },
  { id: 2, type: 'earn', amount: 300, description: 'Referral signup', date: '2024-04-02', status: 'completed' },
  { id: 3, type: 'redeem', amount: -500, description: 'Free maintenance', date: '2024-04-03', status: 'completed' },
  { id: 4, type: 'earn', amount: 500, description: 'Friend booked visit', date: '2024-04-04', status: 'pending' },
];

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'earned', label: 'Earned' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'pending', label: 'Pending' },
];

const TAB_WIDTH = (SCREEN_WIDTH - 40) / TABS.length;

const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

interface CoinDisplayProps {
  amount: number;
}

const CoinDisplay: React.FC<CoinDisplayProps> = memo(({ amount }) => {
  return (
    <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.coinDisplayContainer}>
      <Text style={styles.coinLabel}>GreenCoins Balance</Text>
      <View style={styles.coinRow}>
        <Text style={styles.coinIcon}>🪙</Text>
        <Text style={styles.coinAmount}>{amount.toLocaleString()}</Text>
      </View>
      <Text style={styles.coinSubtext}>Keep referring to earn more!</Text>
    </Animated.View>
  );
});

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabBar: React.FC<TabBarProps> = memo(({ activeTab, onTabChange }) => {
  const translateX = useSharedValue(0);
  
  const activeIndex = TABS.findIndex(t => t.key === activeTab);
  
  React.useEffect(() => {
    translateX.value = withSpring(activeIndex * TAB_WIDTH, {
      damping: 20,
      stiffness: 200,
    });
  }, [activeIndex, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleTabPress = async (tab: TabType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tab);
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
    </View>
  );
});

interface TransactionItemProps {
  item: Transaction;
  index: number;
}

const TransactionItem: React.FC<TransactionItemProps> = memo(({ item, index }) => {
  const isEarn = item.type === 'earn';
  const isPending = item.status === 'pending';
  
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      layout={Layout.springify()}
      style={styles.transactionItem}
    >
      <View style={styles.transactionContent}>
        {/* Left Icon */}
        <View
          style={[
            styles.transactionIcon,
            { backgroundColor: isEarn ? '#ECFDF5' : '#FEF2F2' },
          ]}
        >
          <Ionicons
            name={isEarn ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={isEarn ? COLORS.primary : '#EF4444'}
          />
        </View>

        {/* Center: Description + Date */}
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>{formatRelativeDate(item.date)}</Text>
            <Text style={styles.transactionDateFull}> • {formatDate(item.date)}</Text>
          </View>
        </View>

        {/* Right: Amount */}
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: isEarn ? COLORS.primary : '#EF4444' },
            ]}
          >
            {isEarn ? '+' : ''}{item.amount.toLocaleString()}
          </Text>
          
          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isPending ? styles.statusPending : styles.statusCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPending ? styles.statusTextPending : styles.statusTextCompleted,
              ]}
            >
              {isPending ? 'Pending' : 'Completed'}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

const EmptyState: React.FC = memo(() => (
  <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="wallet-outline" size={64} color={COLORS.gray[300]} />
    </View>
    <Text style={styles.emptyTitle}>No transactions yet</Text>
    <Text style={styles.emptySubtitle}>Start referring to earn GreenCoins!</Text>
  </Animated.View>
));

const WalletScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const totalCoins = useMemo(() => {
    return TRANSACTIONS
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }, []);

  const filteredTransactions = useMemo(() => {
    switch (activeTab) {
      case 'earned':
        return TRANSACTIONS.filter(t => t.type === 'earn' && t.status === 'completed');
      case 'redeemed':
        return TRANSACTIONS.filter(t => t.type === 'redeem');
      case 'pending':
        return TRANSACTIONS.filter(t => t.status === 'pending');
      default:
        return TRANSACTIONS;
    }
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const renderTransaction = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <TransactionItem item={item} index={index} />
    ),
    []
  );

  const keyExtractor = useCallback((item: Transaction) => item.id.toString(), []);

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <Text style={styles.sectionSubtitle}>
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </Text>
      </View>
    ),
    [filteredTransactions.length]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Gold Gradient Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerDecor}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
          <View style={[styles.decorCircle, styles.decorCircle3]} />
        </View>
        <CoinDisplay amount={totalCoins} />
      </View>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: '#D97706',
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorCircle1: {
    width: 150,
    height: 150,
    top: -50,
    right: -30,
  },
  decorCircle2: {
    width: 100,
    height: 100,
    bottom: -20,
    left: -20,
  },
  decorCircle3: {
    width: 60,
    height: 60,
    top: 40,
    left: 80,
  },

  // Coin Display
  coinDisplayContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    zIndex: 1,
  },
  coinLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 8,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coinIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  coinAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1,
  },
  coinSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Tab Bar
  tabContainer: {
    backgroundColor: COLORS.white,
    paddingTop: 16,
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    width: TAB_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[400],
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    width: TAB_WIDTH - 24,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[900],
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray[500],
  },

  // Transaction Item
  transactionItem: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionDate: {
    fontSize: 12,
    color: COLORS.gray[500],
    fontWeight: '500',
  },
  transactionDateFull: {
    fontSize: 12,
    color: COLORS.gray[400],
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#ECFDF5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: COLORS.primary,
  },
  statusTextPending: {
    color: '#D97706',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  },
});

export default WalletScreen;
