import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
import {
  fetchMyProject,
  uploadProjectFile,
  uploadStageDocument,
  getDocumentAccessUrl,
  type ProjectStage,
  type RequiredDocumentSlot,
} from '../services/project.service';
import { settingsService } from '../services/settings.service';
import { leadService, type Lead } from '../services/lead.service';
import { getErrorMessage } from '../services/api';
import type { MainStackParamList } from '../navigation/types';

type UploadTarget = {
  stage: ProjectStage;
  name: string;
  taskId?: string;
  docId?: string;
  required?: boolean;
};

const MyProjectScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['myProject'],
    queryFn: fetchMyProject,
    staleTime: 30000,
  });

  const { data: featureFlags } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: () => settingsService.getFeatures(),
    staleTime: 60000,
  });

  const customerDocsEnabled =
    project?.features?.customerDocumentsEnabled ??
    featureFlags?.customerDocumentsEnabled ??
    true;

  const { data: myLeads = [] } = useQuery({
    queryKey: ['myLeads'],
    queryFn: () => leadService.getMyLeads(),
    enabled: !isLoading && !project,
    staleTime: 30000,
  });

  const primaryLead: Lead | null =
    myLeads.find((l) => l.status === 'converted') ||
    myLeads.find((l) => ['pending', 'contacted', 'visited'].includes(l.status)) ||
    myLeads[0] ||
    null;

  const LEAD_STATUS_TEXT: Record<string, string> = {
    pending: 'Your site visit is scheduled. We will confirm the date with you.',
    contacted: 'Our team will reach out shortly about your site visit.',
    visited: 'Site visit completed. We are reviewing your property details.',
    converted: 'You are approved. Installation tracking will appear here once your project is started in our system.',
    lost: 'This site visit is closed. Contact us if you need help.',
  };

  const cv = project?.customerView;
  const focusStageId = project?.currentStageId ?? cv?.currentStageId ?? null;
  const visiblePhases = (project?.phases ?? [])
    .map((phase) => ({
      ...phase,
      stages: (phase.stages ?? []).filter((s) => s.visibleToCustomer),
    }))
    .filter((p) => p.stages.length > 0);

  const doneCount = visiblePhases.reduce(
    (acc, p) => acc + p.stages.filter((s) => s.status === 'done').length,
    0
  );
  const totalCount = visiblePhases.reduce((acc, p) => acc + p.stages.length, 0);
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

  const uploadKey = (target: UploadTarget) =>
    `${target.stage.stageId}:${target.taskId ?? ''}:${target.docId ?? ''}`;

  const hasDocForTarget = (stage: ProjectStage, target: UploadTarget) =>
    (stage.documents ?? []).some((d) => {
      if (d.verificationStatus === 'rejected') return false;
      if (target.docId) return d.docId === target.docId;
      if (target.taskId) return d.taskId === target.taskId;
      return d.name === target.name;
    });

  const getDocForTarget = (stage: ProjectStage, target: UploadTarget) =>
    (stage.documents ?? []).find((d) => {
      if (target.docId) return d.docId === target.docId;
      if (target.taskId) return d.taskId === target.taskId;
      return d.name === target.name;
    });

  const performUpload = async (target: UploadTarget, base64: string, mimeType: string) => {
    if (!project?.projectId) return;

    if (!customerDocsEnabled && !stageNeedsUploads(target.stage)) {
      Toast.show({ type: 'error', text1: 'Document uploads are disabled' });
      return;
    }

    const key = uploadKey(target);
    setUploadingKey(key);
    try {
      const uploadRes = await uploadProjectFile(base64, mimeType);
      if (!uploadRes.publicId) {
        throw new Error('Upload did not return a file reference');
      }
      await uploadStageDocument(project.projectId, target.stage.stageId, {
        name: target.name,
        publicId: uploadRes.publicId,
        taskId: target.taskId,
        docId: target.docId,
        mimeType: uploadRes.mimeType,
        resourceType: uploadRes.resourceType,
        format: uploadRes.format,
      });
      await queryClient.invalidateQueries({ queryKey: ['myProject'] });
      Toast.show({ type: 'success', text1: 'Document uploaded', text2: 'Pending team review' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: getErrorMessage(err) });
    } finally {
      setUploadingKey(null);
    }
  };

  const pickImage = async (target: UploadTarget, fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          base64: true,
          quality: 0.8,
        });

    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${asset.base64}`;
    await performUpload(target, dataUri, mimeType);
  };

  const pickPdf = async (target: UploadTarget) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUri = `data:application/pdf;base64,${base64}`;
    await performUpload(target, dataUri, 'application/pdf');
  };

  const showUploadChooser = (target: UploadTarget) => {
    if (!customerDocsEnabled && !stageNeedsUploads(target.stage)) {
      Toast.show({ type: 'error', text1: 'Document uploads are disabled' });
      return;
    }
    if (target.stage.status !== 'active' && target.stage.status !== 'delayed') {
      Toast.show({
        type: 'info',
        text1: 'Not ready yet',
        text2: 'Your team will activate this stage before you can upload.',
      });
      return;
    }

    const options = [
      { text: 'Take photo', onPress: () => void pickImage(target, true) },
      { text: 'Choose photo', onPress: () => void pickImage(target, false) },
      { text: 'Choose PDF', onPress: () => void pickPdf(target) },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    if (Platform.OS === 'ios') {
      Alert.alert('Upload document', target.name, options);
    } else {
      Alert.alert('Upload document', target.name, options.slice(0, 3).concat(options.slice(3)));
    }
  };

  const viewDocument = async (stage: ProjectStage, docMongoId: string) => {
    if (!project?.projectId || !docMongoId) return;
    try {
      const url = await getDocumentAccessUrl(project.projectId, stage.stageId, docMongoId);
      await Linking.openURL(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open document' });
    }
  };

  const customerRequiredSlots = (stage: ProjectStage): RequiredDocumentSlot[] =>
    (stage.requiredDocuments ?? []).filter(
      (d) => d.uploadedBy === 'customer' || d.uploadedBy === 'both'
    );

  const taskAllowsCustomerUpload = (task: ProjectStage['tasks'][number]) =>
    task.customerUploadPolicy === 'required' ||
    task.customerUploadPolicy === 'optional' ||
    (task.docRequired && task.teamUploadPolicy !== 'required' && task.teamUploadPolicy !== 'optional');

  const stageNeedsUploads = (stage: ProjectStage) => {
    const taskUploads = (stage.tasks ?? []).some(taskAllowsCustomerUpload);
    const slotUploads = customerRequiredSlots(stage).length > 0;
    return taskUploads || slotUploads;
  };

  const buildUploadTargets = (stage: ProjectStage): UploadTarget[] => {
    const targets: UploadTarget[] = [];

    for (const slot of customerRequiredSlots(stage)) {
      targets.push({
        stage,
        name: slot.label || 'Document',
        docId: slot.docId,
        required: slot.required,
      });
    }

    for (const task of stage.tasks ?? []) {
      if (!taskAllowsCustomerUpload(task)) continue;
      if (!targets.some((t) => t.taskId === task.taskId)) {
        targets.push({
          stage,
          name: task.name,
          taskId: task.taskId,
          required: task.customerUploadPolicy === 'required',
        });
      }
    }

    return targets;
  };

  const renderDocRow = (stage: ProjectStage, target: UploadTarget) => {
    const uploaded = hasDocForTarget(stage, target);
    const doc = getDocForTarget(stage, target);
    const key = uploadKey(target);
    const isUploading = uploadingKey === key;

    return (
      <View key={key} style={styles.docRow}>
        <Text style={uploaded ? styles.docCheck : styles.docPending}>
          {uploaded ? '✓' : '○'}
        </Text>
        <View style={styles.docNameCol}>
          <Text style={styles.docName}>
            {target.name}
            {target.required ? ' *' : ''}
          </Text>
          {doc?.verificationStatus === 'rejected' && (
            <Text style={styles.docRejected}>
              Rejected{doc.rejectionReason ? `: ${doc.rejectionReason}` : ''}
            </Text>
          )}
          {doc?.verificationStatus === 'pending' && uploaded && (
            <Text style={styles.docPendingLabel}>Pending review</Text>
          )}
          {doc?.verificationStatus === 'verified' && (
            <Text style={styles.docVerified}>Verified</Text>
          )}
        </View>
        {!uploaded || doc?.verificationStatus === 'rejected' ? (
          <TouchableOpacity
            style={styles.docUploadBtn}
            disabled={isUploading}
            onPress={() => showUploadChooser(target)}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#185FA5" />
            ) : (
              <Text style={styles.docUploadText}>Upload</Text>
            )}
          </TouchableOpacity>
        ) : doc?._id ? (
          <TouchableOpacity
            style={styles.docViewBtn}
            onPress={() => void viewDocument(stage, doc._id!)}
          >
            <Text style={styles.docViewText}>View</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Installation Tracking</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : isError || !project ? (
        <ScrollView contentContainerStyle={styles.emptyScroll}>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>☀️</Text>
            <Text style={styles.emptyTitle}>
              {primaryLead ? 'Your solar journey' : 'No project yet'}
            </Text>
            {primaryLead ? (
              <>
                <View style={styles.leadStatusCard}>
                  <Text style={styles.leadStatusLabel}>Site visit status</Text>
                  <Text style={styles.leadStatusValue}>
                    {primaryLead.status === 'converted'
                      ? 'Installation confirmed'
                      : primaryLead.status.charAt(0).toUpperCase() + primaryLead.status.slice(1)}
                  </Text>
                  <Text style={styles.leadStatusHint}>
                    {LEAD_STATUS_TEXT[primaryLead.status] ||
                      'We will update you as your visit progresses.'}
                  </Text>
                  {primaryLead.preferredDate ? (
                    <Text style={styles.leadStatusMeta}>
                      Preferred visit:{' '}
                      {new Date(primaryLead.preferredDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {primaryLead.timeSlot ? ` · ${primaryLead.timeSlot}` : ''}
                    </Text>
                  ) : null}
                </View>
                {primaryLead.status !== 'converted' ? (
                  <TouchableOpacity
                    style={styles.emptyBtnSecondary}
                    onPress={() => navigation.getParent()?.navigate('MyLeads' as never)}
                  >
                    <Text style={styles.emptyBtnSecondaryText}>View all visits</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptySubtitle}>
                Book a site visit or log in with the same mobile number your GreenPad team used for
                walk-in registration.
              </Text>
            )}
            {!primaryLead ? (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('BookSiteVisit', { mode: 'self' })}
              >
                <Text style={styles.emptyBtnText}>Book a site visit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            {cv?.isDelayed ? (
              <View style={styles.delayBanner}>
                <Ionicons name="warning" size={18} color="#BA7517" />
                <Text style={styles.delayBannerText}>Delayed</Text>
              </View>
            ) : null}

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current Phase</Text>
              <Text style={styles.statusValue}>{cv?.currentPhase || '—'}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current Stage</Text>
              <Text style={styles.statusValue}>{cv?.currentStage || '—'}</Text>
            </View>
            {cv?.currentWork ? (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Current Work</Text>
                <Text style={styles.statusValueHighlight}>{cv.currentWork}</Text>
              </View>
            ) : null}
            <View style={[styles.statusPill, cv?.isDelayed && styles.statusPillDelayed]}>
              <Text style={[styles.statusPillText, cv?.isDelayed && styles.statusPillTextDelayed]}>
                {cv?.statusLabel || 'In Progress'}
              </Text>
            </View>

            {cv?.isDelayed && cv.delayReason ? (
              <View style={styles.delayBox}>
                <Text style={styles.delayText}>Reason: {cv.delayReason}</Text>
                {cv.delayExpectedDate ? (
                  <Text style={styles.delayExpected}>Expected: {cv.delayExpectedDate}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

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
                  {doneCount} of {totalCount} steps complete
                </Text>
                <Text style={styles.progressPct}>{Math.round(progressPct * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
              </View>
            </View>
          </View>

          {visiblePhases.map((phase, phaseIndex) => (
            <View key={phase.phaseId} style={styles.phaseBlock}>
              <Text style={styles.phaseTitle}>{phase.name}</Text>
              {phase.stages.map((stage, index) => {
                const isLast =
                  phaseIndex === visiblePhases.length - 1 && index === phase.stages.length - 1;
                const isDone = stage.status === 'done';
                const isDelayed = stage.status === 'delayed';
                const isLiveStage = stage.status === 'active' || isDelayed;
                const isFocused = !focusStageId || stage.stageId === focusStageId;
                const isCurrentStage = isLiveStage && isFocused;
                const isWaiting = !isDone && !isCurrentStage;
                const nextTask = stage.tasks?.find((t) => !t.completed);
                const uploadsEnabled = customerDocsEnabled || stageNeedsUploads(stage);
                const showDocs =
                  isCurrentStage && stageNeedsUploads(stage) && uploadsEnabled;
                const uploadTargets = buildUploadTargets(stage);

                return (
                  <Animated.View
                    key={stage.stageId}
                    entering={FadeInDown.delay(index * 40).duration(350)}
                    style={styles.stageRow}
                  >
                    <View style={styles.dotColumn}>
                      <View style={styles.dotWrapper}>
                        {isCurrentStage && !isDelayed && (
                          <Animated.View style={[styles.pulseRing, pulseStyle]} />
                        )}
                        <View
                          style={[
                            styles.dot,
                            isDone && styles.dotDone,
                            isCurrentStage && !isDelayed && styles.dotActive,
                            isCurrentStage && isDelayed && styles.dotDelayed,
                            isWaiting && styles.dotPending,
                          ]}
                        >
                          {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
                          {isCurrentStage && !isDelayed && (
                            <Ionicons name="refresh" size={10} color="#185FA5" />
                          )}
                          {isCurrentStage && isDelayed && (
                            <Ionicons name="warning" size={10} color="#BA7517" />
                          )}
                          {isWaiting && <Ionicons name="time-outline" size={10} color="#999" />}
                        </View>
                      </View>
                      {!isLast && <View style={[styles.connector, isDone && styles.connectorDone]} />}
                    </View>

                    <View style={[styles.stageContent, !isLast && { paddingBottom: 20 }]}>
                      <Text style={[styles.stageName, isDone && styles.stageNameDone]}>{stage.name}</Text>
                      <Text
                        style={[
                          styles.stageStatus,
                          isDone && { color: '#1D9E75' },
                          isCurrentStage && !isDelayed && { color: '#185FA5' },
                          isCurrentStage && isDelayed && { color: '#BA7517' },
                        ]}
                      >
                        {isDone
                          ? 'Completed'
                          : isCurrentStage && isDelayed
                            ? 'Delayed'
                            : isCurrentStage
                              ? nextTask
                                ? `In progress · ${nextTask.name}`
                                : 'In progress'
                              : 'Waiting'}
                      </Text>

                      {showDocs && uploadTargets.length > 0 ? (
                        <View style={styles.docsCard}>
                          <Text style={styles.docsCardTitle}>Documents needed</Text>
                          {uploadTargets.map((target) => renderDocRow(stage, target))}
                        </View>
                      ) : null}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          ))}

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
  statusCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#ebebeb',
  },
  delayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  delayBannerText: { fontSize: 14, fontWeight: '700', color: '#BA7517' },
  statusRow: { marginBottom: 10 },
  statusLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginTop: 2 },
  statusValueHighlight: { fontSize: 14, fontWeight: '600', color: '#185FA5', marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EBF3FB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  statusPillDelayed: { backgroundColor: '#FAEEDA' },
  statusPillText: { fontSize: 12, fontWeight: '600', color: '#185FA5' },
  statusPillTextDelayed: { color: '#BA7517' },
  delayBox: {
    backgroundColor: '#FAEEDA',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  delayText: { fontSize: 12, color: '#92560a' },
  delayExpected: { fontSize: 11, color: '#a0600c', marginTop: 4 },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
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
  phaseBlock: { paddingHorizontal: 20, paddingTop: 16 },
  phaseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
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
  connector: { width: 2, flex: 1, minHeight: 16, backgroundColor: '#e0e0e0', marginVertical: 3 },
  connectorDone: { backgroundColor: '#1D9E75' },
  stageContent: { flex: 1 },
  stageName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  stageNameDone: { color: '#555' },
  stageStatus: { fontSize: 12, color: '#aaa', marginTop: 2 },
  docsCard: {
    backgroundColor: '#EBF3FB',
    borderWidth: 1,
    borderColor: '#C5DCF5',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  docsCardTitle: { fontSize: 14, fontWeight: '600', color: '#185FA5', marginBottom: 6 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  docCheck: { fontSize: 14, color: '#1D9E75', width: 18, textAlign: 'center' },
  docPending: { fontSize: 14, color: '#999', width: 18, textAlign: 'center' },
  docNameCol: { flex: 1 },
  docName: { fontSize: 14, color: '#1a1a1a' },
  docRejected: { fontSize: 11, color: '#DC2626', marginTop: 2 },
  docPendingLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  docVerified: { fontSize: 11, color: '#1D9E75', marginTop: 2 },
  docUploadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#185FA5',
    minWidth: 64,
    alignItems: 'center',
  },
  docUploadText: { fontSize: 12, fontWeight: '600', color: '#185FA5' },
  docViewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1D9E75',
    minWidth: 64,
    alignItems: 'center',
  },
  docViewText: { fontSize: 12, fontWeight: '600', color: '#1D9E75' },
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
  emptyScroll: { flexGrow: 1, paddingBottom: 32 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  leadStatusCard: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  leadStatusLabel: { fontSize: 12, fontWeight: '600', color: '#166534', textTransform: 'uppercase' },
  leadStatusValue: { fontSize: 18, fontWeight: '700', color: '#14532d', marginTop: 6 },
  leadStatusHint: { fontSize: 13, color: '#3f6212', marginTop: 8, lineHeight: 18 },
  leadStatusMeta: { fontSize: 12, color: '#4d7c0f', marginTop: 10 },
  emptyBtnSecondary: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1D9E75',
  },
  emptyBtnSecondaryText: { color: '#1D9E75', fontWeight: '600', fontSize: 14 },
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
