import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import { useAuthStore } from '../stores';
import { notificationService } from '../services';
import { useNotificationStore } from '../stores/notificationStore';
import { COLORS } from '../constants';
import { ONBOARDING_KEY } from '../screens/auth/OnboardingScreen';

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    void initialize();
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setShowOnboarding(val !== 'true'))
      .catch(() => setShowOnboarding(false));
  }, [initialize]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    (async () => {
      try {
        const token = await notificationService.registerForPushNotifications();
        if (token && mounted) {
          await notificationService.savePushToken(token);
        }
      } catch {
        // notification setup failed silently
      }
    })();

    const receivedSub = notificationService.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        addNotification({
          title: title || 'GreenPad',
          body: body || '',
          type: 'system',
        });
      }
    );

    return () => {
      mounted = false;
      receivedSub.remove();
    };
  }, [isAuthenticated, addNotification]);

  const handleOnboardingDone = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  if (!isInitialized || showOnboarding === null) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
};

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});

export default RootNavigator;
