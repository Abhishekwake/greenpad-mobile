import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants';
import { useNotificationStore, AppNotification } from '../../stores/notificationStore';

const ICON_MAP: Record<AppNotification['type'], { name: any; color: string; bg: string }> = {
  referral: { name: 'people', color: '#2563EB', bg: '#EFF6FF' },
  coins: { name: 'flash', color: '#F59E0B', bg: '#FFFBEB' },
  lead: { name: 'calendar', color: '#10B981', bg: '#ECFDF5' },
  system: { name: 'information-circle', color: '#6B7280', bg: '#F3F4F6' },
};

const formatTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const NotificationItem = React.memo(
  ({ item, onPress }: { item: AppNotification; onPress: (id: string) => void }) => {
    const icon = ICON_MAP[item.type];
    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        onPress={() => onPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, !item.read && styles.itemTitleBold]}>
            {item.title}
          </Text>
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.itemTime}>{formatTime(item.timestamp)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  }
);

const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { notifications, markAsRead, markAllRead } = useNotificationStore();

  const handleItemPress = useCallback(
    (id: string) => markAsRead(id),
    [markAsRead]
  );

  const renderItem: ListRenderItem<AppNotification> = useCallback(
    ({ item }) => <NotificationItem item={item} onPress={handleItemPress} />,
    [handleItemPress]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.gray[300]} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see referral updates, coin earnings, and more here.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.gray[900] },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  list: { paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  itemUnread: { backgroundColor: '#F0FDF4' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, color: COLORS.gray[800], marginBottom: 2 },
  itemTitleBold: { fontWeight: '700' },
  itemBody: { fontSize: 13, color: COLORS.gray[500], lineHeight: 18, marginBottom: 4 },
  itemTime: { fontSize: 11, color: COLORS.gray[400] },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginLeft: 8,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.gray[500], marginTop: 16 },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray[400],
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default NotificationsScreen;
