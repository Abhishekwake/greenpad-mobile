import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import Animated, {
  FadeIn,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES } from '../../constants';
import { useAuthStore } from '../../stores';
import { leadService } from '../../services';
import { getErrorMessage } from '../../services/api';
import { LoadingOverlay } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';

const TOTAL_STEPS = 4;

function startOfTomorrow(): Date {
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

function isDateAtLeastTomorrow(d: Date): boolean {
  const min = new Date();
  min.setDate(min.getDate() + 1);
  min.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime() >= min.getTime();
}

const propertyTypeEnum = z.enum(['residential', 'commercial', 'industrial', 'agricultural']);
const timeSlotEnum = z.enum(['morning', 'afternoon', 'evening']);

const bookingSchema = z.object({
  fullName: z.string().min(3, 'At least 3 characters'),
  phone: z.string().min(8, 'Phone number required'),
  email: z
    .string()
    .trim()
    .refine((s) => s === '' || z.string().email().safeParse(s).success, {
      message: 'Enter a valid email or leave blank',
    }),
  address: z.string().min(10, 'Please enter full address (min 10 characters)'),
  propertyType: propertyTypeEnum,
  roofAreaSqFt: z.number().min(100).max(5000),
  preferredDate: z.date().refine((d) => isDateAtLeastTomorrow(d), {
    message: 'Choose tomorrow or a later date',
  }),
  timeSlot: timeSlotEnum,
  notes: z.string(),
  agreeToTerms: z.boolean().refine((v) => v === true, {
    message: 'Please agree to the terms to continue',
  }),
});

export type BookingFormValues = z.infer<typeof bookingSchema>;

const STEP_FIELDS: Record<number, (keyof BookingFormValues)[]> = {
  1: ['fullName', 'phone', 'email'],
  2: ['address', 'propertyType', 'roofAreaSqFt'],
  3: ['preferredDate', 'timeSlot', 'notes'],
  4: ['agreeToTerms'],
};

const PROPERTY_OPTIONS: {
  value: z.infer<typeof propertyTypeEnum>;
  label: string;
  emoji: string;
}[] = [
  { value: 'residential', label: 'Residential', emoji: '🏠' },
  { value: 'commercial', label: 'Commercial', emoji: '🏢' },
  { value: 'industrial', label: 'Industrial', emoji: '🏭' },
  { value: 'agricultural', label: 'Agricultural', emoji: '🌾' },
];

const TIME_SLOTS: {
  value: z.infer<typeof timeSlotEnum>;
  label: string;
  sub: string;
  emoji: string;
}[] = [
  { value: 'morning', label: 'Morning', sub: '9–12', emoji: '🌅' },
  { value: 'afternoon', label: 'Afternoon', sub: '12–4', emoji: '☀️' },
  { value: 'evening', label: 'Evening', sub: '4–7', emoji: '🌆' },
];

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const TIME_SLOT_MAP: Record<string, string> = {
  morning: 'Morning (9-12)',
  afternoon: 'Afternoon (12-4)',
  evening: 'Evening (4-7)',
};

const PROPERTY_TYPE_MAP: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  agricultural: 'Agricultural',
};

const SuccessView: React.FC<{ coinsEarned: number; onHome: () => void }> = ({ coinsEarned, onHome }) => {
  const scale = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1, { damping: 12, stiffness: 120 })
    );
    ring.value = withTiming(1, { duration: 600 });
  }, [ring, scale]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 0.8 + ring.value * 0.2 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.successRoot}>
      <View style={styles.successIconWrap}>
        <Animated.View style={[styles.successRing, ringStyle]} />
        <Animated.View style={[styles.successCheckWrap, checkStyle]}>
          <Ionicons name="checkmark-circle" size={120} color={COLORS.primary} />
        </Animated.View>
      </View>
      <Text style={styles.successTitle}>Visit Scheduled Successfully!</Text>
      <View style={styles.coinsBanner}>
        <Text style={styles.coinsBannerText}>+{coinsEarned} coins earned</Text>
      </View>
      <Text style={styles.successBody}>Our team will call you within 2 hours</Text>
      <TouchableOpacity style={styles.homeBtn} onPress={onHome} activeOpacity={0.85}>
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

function buildDefaultPhone(p: string | null): string {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `+91${last10}` : p;
}

function buildDefaultValues(phone: string | null, name?: string): BookingFormValues {
  return {
    fullName: name || '',
    phone: buildDefaultPhone(phone),
    email: '',
    address: '',
    propertyType: 'residential',
    roofAreaSqFt: 500,
    preferredDate: startOfTomorrow(),
    timeSlot: 'morning',
    notes: '',
    agreeToTerms: false,
  };
}

const BookSiteVisitScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { phoneNumber, userData, updateCoins } = useAuthStore();

  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [stepKey, setStepKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(100);

  const defaultValues = useMemo(
    () => buildDefaultValues(phoneNumber, userData?.name),
    [phoneNumber, userData?.name]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    defaultValues,
  });

  useEffect(() => {
    setValue('phone', buildDefaultPhone(phoneNumber), { shouldValidate: true });
    if (userData?.name && !watch('fullName')) {
      setValue('fullName', userData.name, { shouldValidate: true });
    }
  }, [phoneNumber, userData?.name, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const watched = watch();
  const canStep1 = useMemo(() => {
    const r = bookingSchema.pick({ fullName: true, phone: true, email: true }).safeParse({
      fullName: watched.fullName,
      phone: watched.phone,
      email: watched.email,
    });
    return r.success;
  }, [watched.fullName, watched.phone, watched.email]);

  const canStep2 = useMemo(() => {
    const r = bookingSchema
      .pick({ address: true, propertyType: true, roofAreaSqFt: true })
      .safeParse({
        address: watched.address,
        propertyType: watched.propertyType,
        roofAreaSqFt: watched.roofAreaSqFt,
      });
    return r.success;
  }, [watched.address, watched.propertyType, watched.roofAreaSqFt]);

  const canStep3 = useMemo(() => {
    const r = bookingSchema
      .pick({ preferredDate: true, timeSlot: true, notes: true })
      .safeParse({
        preferredDate: watched.preferredDate,
        timeSlot: watched.timeSlot,
        notes: watched.notes,
      });
    return r.success;
  }, [watched.preferredDate, watched.timeSlot, watched.notes]);

  const canStep4 = watched.agreeToTerms === true;

  const canProceed =
    step === 1 ? canStep1 : step === 2 ? canStep2 : step === 3 ? canStep3 : step === 4 ? canStep4 : false;

  const goNext = useCallback(async () => {
    const fields = STEP_FIELDS[step];
    const ok = await trigger(fields);
    if (!ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS) {
      setStepKey((k) => k + 1);
      setStep((s) => s + 1);
    }
  }, [step, trigger]);

  const goBack = useCallback(async () => {
    if (step <= 1) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStepKey((k) => k + 1);
    setStep((s) => s - 1);
  }, [step]);

  const onSubmit = useCallback(
    async (data: BookingFormValues) => {
      setIsSubmitting(true);
      try {
        const payload = {
          name: data.fullName,
          phone: data.phone.replace(/\D/g, '').slice(-10),
          address: data.address,
          propertyType: PROPERTY_TYPE_MAP[data.propertyType] || data.propertyType,
          roofArea: Math.round(data.roofAreaSqFt),
          preferredDate: data.preferredDate.toISOString(),
          timeSlot: data.timeSlot,
          notes: data.notes || undefined,
        };

        const response = await leadService.createLead(payload);
        setCoinsEarned(response.data.coinsEarned);

        if (response.data.totalCoins) {
          updateCoins(response.data.totalCoins);
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Booking confirmed!', text2: `+${response.data.coinsEarned} coins earned` });
        setShowSuccess(true);
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Booking failed', text2: getErrorMessage(error) });
      } finally {
        setIsSubmitting(false);
      }
    },
    [updateCoins]
  );

  const onInvalidSubmit = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await trigger(STEP_FIELDS[4]);
  }, [trigger]);

  const handleConfirmPress = useCallback(() => {
    void handleSubmit(onSubmit, onInvalidSubmit)();
  }, [handleSubmit, onSubmit, onInvalidSubmit]);

  const goHome = useCallback(() => {
    setShowSuccess(false);
    setStep(1);
    setStepKey((k) => k + 1);
    reset(buildDefaultValues(phoneNumber, userData?.name));
    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation, phoneNumber, userData?.name, reset]);

  const onDateChange = useCallback(
    (_: unknown, date?: Date) => {
      if (Platform.OS === 'android') setShowDatePicker(false);
      if (date) setValue('preferredDate', date, { shouldValidate: true });
    },
    [setValue]
  );

  if (showSuccess) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <SuccessView coinsEarned={coinsEarned} onHome={goHome} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <LoadingOverlay visible={isSubmitting} message="Submitting..." />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            {step > 1 ? (
              <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="arrow-back" size={24} color={COLORS.gray[900]} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.gray[900]} />
              </TouchableOpacity>
            )}
            <Text style={styles.progressText}>
              Step {step} of {TOTAL_STEPS}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          key={stepKey}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInRight.duration(280)}>
            {step === 1 && (
              <>
                <Text style={styles.stepTitle}>Personal details</Text>
                <Text style={styles.stepHint}>We'll use this to contact you about the visit.</Text>

                <Text style={styles.label}>Full name *</Text>
                <Controller
                  control={control}
                  name="fullName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.fullName && styles.inputError]}
                      placeholder="Enter your full name"
                      placeholderTextColor={COLORS.gray[400]}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      autoCapitalize="words"
                    />
                  )}
                />
                {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}

                <Text style={styles.label}>Phone number</Text>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { value } }) => (
                    <TextInput
                      style={[styles.input, styles.inputDisabled]}
                      value={value}
                      editable={false}
                      selectTextOnFocus={false}
                    />
                  )}
                />
                <Text style={styles.helper}>Linked to your GreenPad account</Text>

                <Text style={styles.label}>Email (optional)</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.gray[400]}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  )}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.stepTitle}>Property details</Text>
                <Text style={styles.stepHint}>Help us prepare for your site survey.</Text>

                <Text style={styles.label}>Address *</Text>
                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.textArea, errors.address && styles.inputError]}
                      placeholder="House / street, area, city, PIN"
                      placeholderTextColor={COLORS.gray[400]}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      multiline
                      textAlignVertical="top"
                      numberOfLines={4}
                    />
                  )}
                />
                {errors.address && <Text style={styles.errorText}>{errors.address.message}</Text>}

                <Text style={styles.label}>Property type *</Text>
                <Controller
                  control={control}
                  name="propertyType"
                  render={({ field: { value, onChange } }) => (
                    <View style={styles.radioGrid}>
                      {PROPERTY_OPTIONS.map((opt) => {
                        const selected = value === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[styles.radioCard, selected && styles.radioCardActive]}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              onChange(opt.value);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.radioEmoji}>{opt.emoji}</Text>
                            <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                />

                <Text style={styles.label}>Roof area (sq ft) *</Text>
                <Text style={styles.sliderValue}>
                  {Math.round(watched.roofAreaSqFt).toLocaleString()} sq ft
                </Text>
                <Controller
                  control={control}
                  name="roofAreaSqFt"
                  render={({ field: { value, onChange } }) => (
                    <Slider
                      style={styles.slider}
                      minimumValue={100}
                      maximumValue={5000}
                      step={50}
                      value={value}
                      onValueChange={onChange}
                      minimumTrackTintColor={COLORS.primary}
                      maximumTrackTintColor={COLORS.gray[200]}
                      thumbTintColor={COLORS.primary}
                    />
                  )}
                />
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.stepTitle}>Schedule</Text>
                <Text style={styles.stepHint}>Pick a convenient slot for our engineer.</Text>

                <Text style={styles.label}>Preferred date *</Text>
                <Controller
                  control={control}
                  name="preferredDate"
                  render={({ field: { value } }) => (
                    <>
                      {Platform.OS === 'android' && (
                        <TouchableOpacity
                          style={styles.dateBtn}
                          onPress={() => setShowDatePicker(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                          <Text style={styles.dateBtnText}>{formatDisplayDate(value)}</Text>
                        </TouchableOpacity>
                      )}
                      {(Platform.OS === 'ios' || showDatePicker) && (
                        <DateTimePicker
                          value={value}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={minSelectableDate()}
                          onChange={onDateChange}
                        />
                      )}
                    </>
                  )}
                />
                {errors.preferredDate && (
                  <Text style={styles.errorText}>{errors.preferredDate.message}</Text>
                )}

                <Text style={[styles.label, { marginTop: 16 }]}>Time slot *</Text>
                <Controller
                  control={control}
                  name="timeSlot"
                  render={({ field: { value, onChange } }) => (
                    <View style={styles.timeRow}>
                      {TIME_SLOTS.map((slot) => {
                        const selected = value === slot.value;
                        return (
                          <TouchableOpacity
                            key={slot.value}
                            style={[styles.timeCard, selected && styles.timeCardActive]}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              onChange(slot.value);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.timeEmoji}>{slot.emoji}</Text>
                            <Text style={[styles.timeTitle, selected && styles.timeTitleActive]}>
                              {slot.label}
                            </Text>
                            <Text style={styles.timeSub}>{slot.sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                />

                <Text style={[styles.label, { marginTop: 8 }]}>Additional notes (optional)</Text>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.textArea}
                      placeholder="Gate code, landmarks, roof access..."
                      placeholderTextColor={COLORS.gray[400]}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      multiline
                      textAlignVertical="top"
                      numberOfLines={3}
                    />
                  )}
                />
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.stepTitle}>Confirm booking</Text>
                <Text style={styles.stepHint}>Review your details before submitting.</Text>

                <View style={styles.summaryCard}>
                  <SummaryRow label="Name" value={watched.fullName} />
                  <SummaryRow label="Phone" value={watched.phone} />
                  <SummaryRow label="Email" value={watched.email || '—'} />
                  <SummaryRow label="Address" value={watched.address} />
                  <SummaryRow
                    label="Property"
                    value={PROPERTY_OPTIONS.find((p) => p.value === watched.propertyType)?.label ?? ''}
                  />
                  <SummaryRow label="Roof area" value={`${Math.round(watched.roofAreaSqFt)} sq ft`} />
                  <SummaryRow label="Date" value={formatDisplayDate(watched.preferredDate)} />
                  <SummaryRow
                    label="Time"
                    value={TIME_SLOTS.find((t) => t.value === watched.timeSlot)?.label ?? ''}
                  />
                  {watched.notes ? <SummaryRow label="Notes" value={watched.notes} /> : null}
                </View>

                <Controller
                  control={control}
                  name="agreeToTerms"
                  render={({ field: { value, onChange } }) => (
                    <TouchableOpacity
                      style={styles.termsRow}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onChange(!value);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.checkbox, value && styles.checkboxOn]}>
                        {value ? <Ionicons name="checkmark" size={16} color={COLORS.white} /> : null}
                      </View>
                      <Text style={styles.termsText}>I agree to the terms and privacy policy</Text>
                    </TouchableOpacity>
                  )}
                />
                {errors.agreeToTerms && (
                  <Text style={styles.errorText}>{errors.agreeToTerms.message}</Text>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
              onPress={goNext}
              disabled={!canProceed}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, (!canProceed || isSubmitting) && styles.primaryBtnDisabled]}
              onPress={handleConfirmPress}
              disabled={!canProceed || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Confirm Booking</Text>
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerSpacer: { width: 40 },
  progressText: { fontSize: 15, fontWeight: '700', color: COLORS.gray[800] },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.gray[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  scrollContent: { padding: SIZES.padding, paddingBottom: 120 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.gray[900], marginBottom: 6 },
  stepHint: { fontSize: 14, color: COLORS.gray[500], marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.gray[700], marginBottom: 8 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: SIZES.md,
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  inputDisabled: { backgroundColor: COLORS.gray[50], color: COLORS.gray[600] },
  inputError: { borderColor: '#EF4444' },
  textArea: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.md,
    color: COLORS.gray[900],
    minHeight: 100,
    marginBottom: 4,
  },
  helper: { fontSize: 12, color: COLORS.gray[400], marginBottom: 16, marginTop: -4 },
  errorText: { fontSize: 13, color: '#EF4444', marginBottom: 12 },
  radioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  radioCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  radioCardActive: { borderColor: COLORS.primary, backgroundColor: '#ECFDF5' },
  radioEmoji: { fontSize: 28, marginBottom: 6 },
  radioLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray[700], textAlign: 'center' },
  radioLabelActive: { color: COLORS.primary },
  sliderValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  slider: { width: '100%', height: 44, marginBottom: 8 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: SIZES.radius,
    padding: 14,
  },
  dateBtnText: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.gray[900] },
  timeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  timeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timeCardActive: { borderColor: COLORS.primary, backgroundColor: '#ECFDF5' },
  timeEmoji: { fontSize: 22, marginBottom: 4 },
  timeTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray[800] },
  timeTitleActive: { color: COLORS.primary },
  timeSub: { fontSize: 11, color: COLORS.gray[500], marginTop: 2 },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: COLORS.gray[500], marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: COLORS.gray[900], lineHeight: 22 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termsText: { flex: 1, fontSize: 14, color: COLORS.gray[700], lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.gray[300] },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  successRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  successIconWrap: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  successCheckWrap: {},
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  coinsBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  coinsBannerText: { fontSize: 17, fontWeight: '800', color: '#B45309' },
  successBody: {
    fontSize: 15,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  homeBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});

export default BookSiteVisitScreen;
