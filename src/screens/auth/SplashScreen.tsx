import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../../constants';
import { useAuthStore } from '../../stores';

type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
};

type SplashScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

interface Props {
  navigation: SplashScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const { isAuthenticated, initialize, isInitialized } = useAuthStore();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    initialize();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      const timer = setTimeout(() => {
        if (!isAuthenticated) {
          navigation.replace('Login');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isInitialized, isAuthenticated, navigation]);

  return (
    <LinearGradient
      colors={[COLORS.primary, '#059669', '#047857']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>☀️</Text>
        </View>
        <Text style={styles.appName}>GreenPad</Text>
        <Text style={styles.tagline}>Solar Referral Rewards</Text>
      </Animated.View>
      
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>Powering a greener future</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 56,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: SIZES.lg,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: SIZES.md,
  },
});

export default SplashScreen;
