import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, OTP_CONFIG } from '../../constants';
import { authService } from '../../services';
import { getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../stores';
import type { UserData } from '../../stores/authStore';

type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string; devOtp?: string };
};

type OTPScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;
type OTPScreenRouteProp = RouteProp<AuthStackParamList, 'OTP'>;

interface Props {
  navigation: OTPScreenNavigationProp;
  route: OTPScreenRouteProp;
}

function digitsToOtpArray(code: string): string[] {
  const digits = code.replace(/\D/g, '').slice(0, OTP_CONFIG.LENGTH).split('');
  const next = new Array(OTP_CONFIG.LENGTH).fill('');
  digits.forEach((d, i) => {
    next[i] = d;
  });
  return next;
}

const OTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber, devOtp: initialDevOtp } = route.params;
  const [otp, setOtp] = useState<string[]>(new Array(OTP_CONFIG.LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(OTP_CONFIG.RESEND_TIMER);
  const [canResend, setCanResend] = useState(false);
  const [serverOtpPreview, setServerOtpPreview] = useState<string | undefined>(initialDevOtp);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { login } = useAuthStore();

  useEffect(() => {
    if (initialDevOtp && /^\d{6}$/.test(initialDevOtp)) {
      setOtp(digitsToOtpArray(initialDevOtp));
    }
  }, [initialDevOtp]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOTPChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').split('').slice(0, OTP_CONFIG.LENGTH);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < OTP_CONFIG.LENGTH) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_CONFIG.LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    if (value && index < OTP_CONFIG.LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== OTP_CONFIG.LENGTH) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Please enter the complete 6-digit OTP' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.verifyOTP(phoneNumber, otpString);

      if (response.success && response.token && response.user) {
        const user: UserData = {
          id: response.user.id,
          name: response.user.name,
          phone: response.user.phone,
          referralCode: response.user.referralCode,
          coins: response.user.coins,
          role: response.user.role,
        };
        await login(response.token, phoneNumber, user);
        Toast.show({ type: 'success', text1: 'Welcome!', text2: 'Login successful' });
      } else {
        Toast.show({ type: 'error', text1: 'Invalid OTP', text2: response.message || 'Please try again' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;

    setIsLoading(true);
    try {
      const response = await authService.sendOTP(phoneNumber);
      if (response.success) {
        setTimer(OTP_CONFIG.RESEND_TIMER);
        setCanResend(false);
        setOtp(new Array(OTP_CONFIG.LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        if (response.otp) {
          setServerOtpPreview(response.otp);
          if (/^\d{6}$/.test(response.otp)) {
            setOtp(digitsToOtpArray(response.otp));
          }
        }
        Toast.show({
          type: 'success',
          text1: 'OTP Sent',
          text2: response.otp ? 'Code shown above for testing' : 'Check your phone',
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: response.message || 'Failed to resend OTP' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const maskedPhone = phoneNumber.replace(/(\+91)(\d{6})(\d{4})/, '$1******$3');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phoneNumber}>{maskedPhone}</Text>
          </Text>
        </View>

        {serverOtpPreview ? (
          <View style={styles.serverOtpBanner} accessibilityLabel="Server test OTP">
            <Text style={styles.serverOtpLabel}>Testing — code from server</Text>
            <Text style={styles.serverOtpValue} selectable>
              {serverOtpPreview}
            </Text>
            <Text style={styles.serverOtpHint}>Remove EXPOSE_OTP_IN_RESPONSE when SMS is live.</Text>
          </View>
        ) : null}

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
              ]}
              value={digit}
              onChangeText={(value) => handleOTPChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus={true}
              editable={!isLoading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            otp.join('').length !== OTP_CONFIG.LENGTH ? styles.buttonDisabled : undefined,
          ]}
          onPress={handleVerifyOTP}
          disabled={isLoading || otp.join('').length !== OTP_CONFIG.LENGTH}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          {canResend ? (
            <TouchableOpacity onPress={handleResendOTP} disabled={isLoading}>
              <Text style={styles.resendText}>
                Didn't receive the code?{' '}
                <Text style={styles.resendLink}>Resend OTP</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend OTP in <Text style={styles.timerHighlight}>{formatTime(timer)}</Text>
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: SIZES.lg,
    color: COLORS.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 12,
  },
  subtitle: {
    fontSize: SIZES.lg,
    color: COLORS.gray[500],
    lineHeight: 24,
  },
  phoneNumber: {
    color: COLORS.gray[700],
    fontWeight: '600',
  },
  serverOtpBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: SIZES.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  serverOtpLabel: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 6,
  },
  serverOtpValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  serverOtpHint: {
    fontSize: SIZES.sm,
    color: COLORS.gray[500],
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.gray[900],
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: COLORS.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.white,
  },
  resendContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  resendText: {
    fontSize: SIZES.md,
    color: COLORS.gray[500],
  },
  resendLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  timerText: {
    fontSize: SIZES.md,
    color: COLORS.gray[500],
  },
  timerHighlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default OTPScreen;
