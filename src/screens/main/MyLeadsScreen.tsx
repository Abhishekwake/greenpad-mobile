import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { COLORS } from '../../constants';
import { leadService } from '../../services';
import type { Lead } from '../../services/lead.service';
import { getErrorMessage } from '../../services/api';
import { ErrorRetry } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';

/** Pipeline order in DB; users never see "converted" wording — only "Installation Confirmed". */
const PIPELINE = ['pending', 'contacted', 'visited', 'converted'] as const;

function normalizeLeadStatus(status: string): string {
  if (status === 'rejected') return 'cancelled';
  return status;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  contacted: { label: 'Contacted', color: '#2563EB', bg: '#EFF6FF', icon: 'call-outline' },
  visited: { label: 'Visited', color: '#7C3AED', bg: '#F5F3FF', icon: 'eye-outline' },
  converted: {
    label: 'Installation Confirmed',
    color: '#059669',
    bg: '#ECFDF5',
    icon: 'checkmark-circle-outline',
  },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle-outline' },
};

const PIPELINE_LABEL: Record<(typeof PIPELINE)[number], string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  visited: 'Visited',
  converted: 'Installation Confirmed',
};

const PROPERTY_EMOJI: Record<string, string> = {
  Residential: '🏠',
  Commercial: '🏢',
  Industrial: '🏭',
  Agricultural: '🌾',
};

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning', sub: '9-12' },
  { value: 'afternoon', label: 'Afternoon', sub: '12-4' },
  { value: 'evening', label: 'Evening', sub: '4-7' },
];

const formatDate = (d: string): string => {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const canModify = (status: string) => {
  const s = normalizeLeadStatus(status);
  return ['pending', 'contacted'].includes(s);
};

const ProgressTracker: React.FC<{ currentStatus: string }> = memo(({ currentStatus }) => {
  const s = normalizeLeadStatus(currentStatus);
  const isTerminalCancelled = s === 'cancelled';

  if (isTerminalCancelled) {
    return (
      <View style={ptStyles.cancelledBanner}>
        <Ionicons name="close-circle" size={20} color="#DC2626" />
        <Text style={ptStyles.cancelledText}>This visit was cancelled</Text>
      </View>
    );
  }

  const rawIdx = PIPELINE.indexOf(s as (typeof PIPELINE)[number]);
  const currentIdx = rawIdx >= 0 ? rawIdx : 0;

  return (
    <View style={ptStyles.container}>
      {PIPELINE.map((statusKey, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isLast = idx === PIPELINE.length - 1;
        const label = PIPELINE_LABEL[statusKey];

        return (
          <View key={statusKey} style={ptStyles.stepRow}>
            <View style={ptStyles.dotColumn}>
              <View
                style={[
                  ptStyles.dot,
                  isPast && ptStyles.dotDone,
                  isCurrent && ptStyles.dotCurrent,
                  isFuture && ptStyles.dotFuture,
                ]}
              >
                {isPast && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                {isCurrent && <View style={ptStyles.dotInner} />}
              </View>
              {!isLast && (
                <View
                  style={[
                    ptStyles.line,
                    isPast && ptStyles.lineDone,
                    isFuture && ptStyles.lineFuture,
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                ptStyles.label,
                (isPast || isCurrent) && ptStyles.labelActive,
                isCurrent && ptStyles.labelCurrent,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const ptStyles = StyleSheet.create({
  container: { marginTop: 16, marginLeft: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dotColumn: { alignItems: 'center', width: 24 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.gray[300], backgroundColor: COLORS.white,
  },
  dotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotCurrent: { borderColor: COLORS.primary, borderWidth: 3, backgroundColor: COLORS.white },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  dotFuture: { borderColor: COLORS.gray[200], backgroundColor: COLORS.gray[50] },
  line: { width: 2, height: 20, backgroundColor: COLORS.gray[200] },
  lineDone: { backgroundColor: COLORS.primary },
  lineFuture: { backgroundColor: COLORS.gray[200] },
  label: { fontSize: 13, color: COLORS.gray[400], marginLeft: 10, marginTop: 1, fontWeight: '500' },
  labelActive: { color: COLORS.gray[700] },
  labelCurrent: { fontWeight: '700', color: COLORS.primary },
  cancelledBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
  },
  cancelledText: { fontSize: 14, fontWeight: '600', color: '#991B1B', flex: 1 },
});

interface LeadCardProps {
  item: Lead;
  index: number;
  onReschedule: (lead: Lead) => void;
  onCancel: (lead: Lead) => void;
}

const LeadCard: React.FC<LeadCardProps> = memo(({ item, index, onReschedule, onCancel }) => {
  const norm = normalizeLeadStatus(item.status);
  const meta = STATUS_META[norm] || STATUS_META.pending;
  const showActions = canModify(item.status);
  const isReferral = item.leadType === 'referral';

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.propertyEmoji}>
              {PROPERTY_EMOJI[item.propertyType] || '🏠'}
            </Text>
            <View style={styles.cardTitleContent}>
              {isReferral && (
                <View style={styles.referralChip}>
                  <Text style={styles.referralChipText}>Referred person’s visit</Text>
                </View>
              )}
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardPhone}>{item.phone}</Text>
              <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={14} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.gray[400]} />
            <Text style={styles.detailText}>{formatDate(item.preferredDate)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="home-outline" size={14} color={COLORS.gray[400]} />
            <Text style={styles.detailText}>{item.propertyType}</Text>
          </View>
          {item.roofArea > 0 && (
            <View style={styles.detailItem}>
              <Ionicons name="resize-outline" size={14} color={COLORS.gray[400]} />
              <Text style={styles.detailText}>{item.roofArea} sq ft</Text>
            </View>
          )}
        </View>

        <ProgressTracker currentStatus={item.status} />

        {showActions && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rescheduleBtn}
              onPress={() => onReschedule(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={16} color={COLORS.primary} />
              <Text style={styles.rescheduleBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onCancel(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

function tomorrowDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function minSelectableDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MyLeadsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<Lead | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(tomorrowDate());
  const [rescheduleSlot, setRescheduleSlot] = useState('morning');
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setError(null);
      const data = await leadService.getMyLeads();
      setLeads(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeads();
    }, [fetchLeads])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeads();
  }, [fetchLeads]);

  const handleRescheduleOpen = useCallback((lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRescheduleTarget(lead);
    setRescheduleDate(tomorrowDate());
    setRescheduleSlot(lead.timeSlot || 'morning');
    setShowDatePicker(Platform.OS === 'ios');
  }, []);

  const handleRescheduleSubmit = useCallback(async () => {
    if (!rescheduleTarget) return;
    setIsSubmitting(true);
    try {
      await leadService.rescheduleLead(rescheduleTarget._id, {
        preferredDate: rescheduleDate.toISOString(),
        timeSlot: rescheduleSlot,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Visit rescheduled', text2: `New date: ${formatDate(rescheduleDate.toISOString())}` });
      setRescheduleTarget(null);
      fetchLeads();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Reschedule failed', text2: getErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  }, [rescheduleTarget, rescheduleDate, rescheduleSlot, fetchLeads]);

  const handleCancel = useCallback((lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Cancel Visit',
      `Are you sure you want to cancel the site visit for "${lead.name}"?`,
      [
        { text: 'Keep Visit', style: 'cancel' },
        {
          text: 'Cancel Visit',
          style: 'destructive',
          onPress: async () => {
            try {
              await leadService.cancelLead(lead._id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.show({ type: 'success', text1: 'Visit cancelled' });
              fetchLeads();
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Cancel failed', text2: getErrorMessage(err) });
            }
          },
        },
      ]
    );
  }, [fetchLeads]);

  const renderItem = useCallback(
    ({ item, index }: { item: Lead; index: number }) => (
      <LeadCard
        item={item}
        index={index}
        onReschedule={handleRescheduleOpen}
        onCancel={handleCancel}
      />
    ),
    [handleRescheduleOpen, handleCancel]
  );

  const keyExtractor = useCallback((item: Lead) => item._id, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.gray[300]} />
          </Animated.View>
          <Text style={styles.loadingText}>Loading your visits...</Text>
        </View>
      </View>
    );
  }

  if (error && leads.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Site Visits</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ErrorRetry message={error} onRetry={fetchLeads} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Site Visits</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={leads}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={leads.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={56} color={COLORS.gray[300]} />
            </View>
            <Text style={styles.emptyTitle}>No site visits yet</Text>
            <Text style={styles.emptySubtitle}>
              Book a site visit and track its progress here.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => navigation.navigate('BookSiteVisit', { mode: 'self' })}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.white} />
              <Text style={styles.emptyCtaText}>Book Site Visit</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Visit</Text>
              <TouchableOpacity onPress={() => setRescheduleTarget(null)}>
                <Ionicons name="close" size={24} color={COLORS.gray[500]} />
              </TouchableOpacity>
            </View>

            {rescheduleTarget && (
              <Text style={styles.modalSubtitle}>
                {rescheduleTarget.name} - {rescheduleTarget.address}
              </Text>
            )}

            <Text style={styles.modalLabel}>New Date</Text>
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.datePickerText}>{formatDate(rescheduleDate.toISOString())}</Text>
              </TouchableOpacity>
            )}
            {(Platform.OS === 'ios' || showDatePicker) && (
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={minSelectableDate()}
                onChange={(_: unknown, date?: Date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (date) setRescheduleDate(date);
                }}
              />
            )}

            <Text style={styles.modalLabel}>Time Slot</Text>
            <View style={styles.slotRow}>
              {TIME_SLOTS.map((slot) => {
                const active = rescheduleSlot === slot.value;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.slotCard, active && styles.slotCardActive]}
                    onPress={() => setRescheduleSlot(slot.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.slotLabel, active && styles.slotLabelActive]}>
                      {slot.label}
                    </Text>
                    <Text style={styles.slotSub}>{slot.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleRescheduleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray[100],
  },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.gray[900] },
  headerSpacer: { width: 36 },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  propertyEmoji: { fontSize: 28, marginRight: 12 },
  cardTitleContent: { flex: 1 },
  referralChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  referralChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.gray[900], marginBottom: 2 },
  cardPhone: { fontSize: 13, color: COLORS.gray[600], marginBottom: 4, fontWeight: '500' },
  cardAddress: { fontSize: 13, color: COLORS.gray[500] },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardDetails: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.gray[100],
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: COLORS.gray[500], fontWeight: '500' },

  actionRow: {
    flexDirection: 'row', gap: 10,
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.gray[100],
  },
  rescheduleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: '#F0FDF4',
  },
  rescheduleBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: COLORS.gray[400] },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.gray[100], justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray[700], marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray[400], textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray[900] },
  modalSubtitle: { fontSize: 14, color: COLORS.gray[500], marginBottom: 20, lineHeight: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.gray[700], marginBottom: 8, marginTop: 12 },
  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[200],
    borderRadius: 12, padding: 14,
  },
  datePickerText: { fontSize: 15, fontWeight: '600', color: COLORS.gray[900] },
  slotRow: { flexDirection: 'row', gap: 8 },
  slotCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 2, borderColor: COLORS.gray[200], backgroundColor: COLORS.white,
  },
  slotCardActive: { borderColor: COLORS.primary, backgroundColor: '#F0FDF4' },
  slotLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray[700] },
  slotLabelActive: { color: COLORS.primary },
  slotSub: { fontSize: 11, color: COLORS.gray[400], marginTop: 2 },
  submitBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16,
    borderRadius: 14, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: COLORS.gray[300] },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});

export default MyLeadsScreen;
