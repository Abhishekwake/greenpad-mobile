import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants';
import { useAuthStore } from '../../stores';
import { userService } from '../../services';
import { getErrorMessage } from '../../services/api';
import { ErrorRetry } from '../../components/ui';

interface ProfileData {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  referralCode: string;
  coins: number;
  totalEarned: number;
  totalRedeemed: number;
  role: string;
  createdAt: string;
}

const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { logout, isLoading: authLoading } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const data = await userService.getProfile();
      setProfile(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    Toast.show({
      type: 'info',
      text1: 'Logging out...',
      visibilityTime: 1000,
    });
    setTimeout(async () => {
      try {
        await logout();
      } catch {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to logout' });
      }
    }, 500);
  };

  const handleSaveName = useCallback(async () => {
    if (!newName.trim() || newName.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'Invalid name', text2: 'Name must be at least 3 characters' });
      return;
    }
    try {
      const updated = await userService.updateProfile({ name: newName.trim() });
      setProfile(updated);
      setEditingName(false);
      Toast.show({ type: 'success', text1: 'Profile updated!', text2: 'Name saved successfully' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(err) });
    }
  }, [newName]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.container}>
        <ErrorRetry message={error} onRetry={fetchProfile} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter name"
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} style={styles.saveBtn}>
                <Ionicons name="checkmark" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingName(false)} style={styles.cancelBtn}>
                <Ionicons name="close" size={20} color={COLORS.gray[600]} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={() => {
                setNewName(profile?.name || '');
                setEditingName(true);
              }}
            >
              <Text style={styles.userName}>{profile?.name || 'GreenPad User'}</Text>
              <Ionicons name="pencil" size={16} color={COLORS.gray[400]} />
            </TouchableOpacity>
          )}
          <Text style={styles.userPhone}>{profile?.phone}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{(profile?.coins ?? 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{(profile?.totalEarned ?? 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{(profile?.totalRedeemed ?? 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Redeemed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <InfoRow icon="call-outline" label="Phone" value={profile?.phone || ''} />
          <InfoRow icon="mail-outline" label="Email" value={profile?.email || 'Not set'} />
          <InfoRow icon="code-outline" label="Referral Code" value={profile?.referralCode || ''} />
          <InfoRow
            icon="calendar-outline"
            label="Joined"
            value={
              profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : ''
            }
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={authLoading}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
          <Text style={styles.logoutButtonText}>
            {authLoading ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const InfoRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={20} color={COLORS.gray[400]} style={styles.infoIcon} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },

  scrollContent: { paddingHorizontal: 20 },

  avatarSection: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 22, fontWeight: '700', color: COLORS.gray[900] },
  userPhone: { fontSize: 14, color: COLORS.gray[500] },
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[900],
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingVertical: 4,
    minWidth: 150,
    textAlign: 'center',
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.gray[900], marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.gray[500] },

  section: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  infoIcon: { marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: COLORS.gray[400], marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600', color: COLORS.gray[900] },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.white },
});

export default ProfileScreen;
