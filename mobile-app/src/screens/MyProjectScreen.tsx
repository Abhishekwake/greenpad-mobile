import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchMyProject } from '../services/project.service';
import type { MainStackParamList } from '../navigation/types';

const MyProjectScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['myProject'],
    queryFn: fetchMyProject,
    staleTime: 30000,
  });

  const visibleStages = project?.stages?.filter((s) => s.visibleToCustomer) ?? [];
  const doneCount = visibleStages.filter((s) => s.status === 'done').length;
  const totalCount = visibleStages.length;
  const progressPct = totalCount > 0 ? doneCount / totalCount : 0;

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.4], [0.4, 0]),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Solar Project</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : isError || !project ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>☀️</Text>
          <Text style={styles.emptyTitle}>No project yet</Text>
          <Text style={styles.emptySubtitle}>
            Your installation project will appear here once your site visit is approved
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('BookSiteVisit', { mode: 'self' })}
          >
            <Text style={styles.emptyBtnText}>Book a site visit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.solarIcon}>
                <Ionicons name="sunny" size={20} color="#1D9E75" />
              </View>
              <View>
                <Text style={styles.customerName}>{project.customerName}</Text>
                <Text style={styles.address}>{project.address}</Text>
              </View>
            </View>
            <View style={styles.progressSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.progressLabel}>
                  {doneCount} of {totalCount} stages complete
                </Text>
                <Text style={styles.progressPct}>{Math.round(progressPct * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.timeline}>
            {visibleStages.map((stage, index) => {
              const isLast = index === visibleStages.length - 1;
              const isDone = stage.status === 'done';
              const isActive = stage.status === 'active';
              const isDelayed = stage.status === 'delayed';
              const isPending = stage.status === 'pending';

              return (
                <Animated.View
                  key={stage.stageId}
                  entering={FadeInDown.delay(index * 60).duration(400)}
                  style={styles.stageRow}
                >
                  <View style={styles.dotColumn}>
                    <View style={styles.dotWrapper}>
                      {isActive && <Animated.View style={[styles.pulseRing, pulseStyle]} />}
                      <View
                        style={[
                          styles.dot,
                          isDone && styles.dotDone,
                          isActive && styles.dotActive,
                          isDelayed && styles.dotDelayed,
                          isPending && styles.dotPending,
                        ]}
                      >
                        {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
                        {isActive && <Ionicons name="refresh" size={10} color="#185FA5" />}
                        {isDelayed && <Ionicons name="warning" size={10} color="#BA7517" />}
                        {isPending && <Ionicons name="time-outline" size={10} color="#999" />}
                      </View>
                    </View>
                    {!isLast && <View style={[styles.connector, isDone && styles.connectorDone]} />}
                  </View>

                  <View style={[styles.stageContent, !isLast && { paddingBottom: 24 }]}>
                    <Text style={[styles.stageName, isDone && styles.stageNameDone]}>{stage.name}</Text>
                    <Text
                      style={[
                        styles.stageStatus,
                        isDone && { color: '#1D9E75' },
                        isActive && { color: '#185FA5' },
                        isDelayed && { color: '#BA7517' },
                      ]}
                    >
                      {isDone
                        ? 'Completed'
                        : isActive
                          ? 'In progress'
                          : isDelayed
                            ? 'Delayed'
                            : 'Waiting'}
                    </Text>

                    {isDelayed && stage.delayReason && (
                      <View style={styles.delayBox}>
                        <Text style={styles.delayText}>⚠ {stage.delayReason}</Text>
                        {stage.delayExpectedDate && (
                          <Text style={styles.delayExpected}>Expected: {stage.delayExpectedDate}</Text>
                        )}
                      </View>
                    )}

                    {isActive && (stage.tasks?.length ?? 0) > 0 && (
                      <View style={styles.taskList}>
                        {(stage.tasks ?? []).map((task) => (
                          <View key={task.taskId} style={styles.taskItem}>
                            <View style={[styles.taskCheck, task.completed && styles.taskCheckDone]}>
                              {task.completed && <Ionicons name="checkmark" size={8} color="#fff" />}
                            </View>
                            <Text style={[styles.taskText, task.completed && styles.taskTextDone]}>
                              {task.name}
                            </Text>
                            {task.docRequired && (
                              <Ionicons name="document-text-outline" size={12} color="#999" />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.contactCard}>
            <Ionicons name="help-circle-outline" size={16} color="#666" />
            <Text style={styles.contactText}>Questions? Contact your project manager</Text>
          </View>
          <View style={styles.contactButtons}>
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={() => Linking.openURL('https://wa.me/919999999999')}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
              <Text style={styles.whatsappText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL('tel:+919999999999')}
            >
              <Ionicons name="call-outline" size={16} color="#1D9E75" />
              <Text style={styles.callText}>Call us</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#ebebeb',
  },
  solarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  address: { fontSize: 12, color: '#888', marginTop: 2 },
  progressSection: { marginTop: 14 },
  progressLabel: { fontSize: 12, color: '#888' },
  progressPct: { fontSize: 12, fontWeight: '600', color: '#1D9E75' },
  progressTrack: { height: 4, backgroundColor: '#e8e8e8', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#1D9E75', borderRadius: 2 },
  timeline: { paddingHorizontal: 20, paddingTop: 20 },
  stageRow: { flexDirection: 'row', gap: 14 },
  dotColumn: { alignItems: 'center', width: 24 },
  dotWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#185FA5',
    opacity: 0.3,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
    zIndex: 1,
  },
  dotDone: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  dotActive: { backgroundColor: '#EBF3FB', borderColor: '#185FA5' },
  dotDelayed: { backgroundColor: '#FAEEDA', borderColor: '#BA7517' },
  dotPending: { backgroundColor: '#f5f5f5', borderColor: '#ddd' },
  connector: { width: 2, flex: 1, minHeight: 20, backgroundColor: '#e0e0e0', marginVertical: 3 },
  connectorDone: { backgroundColor: '#1D9E75' },
  stageContent: { flex: 1 },
  stageName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  stageNameDone: { color: '#555' },
  stageStatus: { fontSize: 12, color: '#aaa', marginTop: 2 },
  delayBox: {
    backgroundColor: '#FAEEDA',
    borderWidth: 0.5,
    borderColor: '#f0c06a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  delayText: { fontSize: 12, color: '#92560a', fontWeight: '500' },
  delayExpected: { fontSize: 11, color: '#a0600c', marginTop: 3, opacity: 0.8 },
  taskList: { marginTop: 8, gap: 6 },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskCheck: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckDone: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  taskText: { fontSize: 12, color: '#555', flex: 1 },
  taskTextDone: { textDecorationLine: 'line-through', color: '#aaa' },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#ebebeb',
  },
  contactText: { fontSize: 13, color: '#666', flex: 1 },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 40,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
  },
  whatsappText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e8f5f0',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1D9E75',
  },
  callText: { color: '#1D9E75', fontSize: 14, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default MyProjectScreen;
