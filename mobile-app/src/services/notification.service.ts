import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Expo Go doesn't support full notification handler — safe to ignore
}

async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'GreenPad',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      })
    ).data;

    return token;
  } catch {
    // Push notifications not available (Expo Go / emulator) — safe to ignore
    return null;
  }
}

async function savePushToken(token: string): Promise<void> {
  try {
    await api.put('/user/push-token', { pushToken: token });
  } catch {
    // silent — token save is best-effort
  }
}

function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
) {
  try {
    return Notifications.addNotificationReceivedListener(handler);
  } catch {
    return { remove: () => {} } as Notifications.Subscription;
  }
}

function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  try {
    return Notifications.addNotificationResponseReceivedListener(handler);
  } catch {
    return { remove: () => {} } as Notifications.Subscription;
  }
}

async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch {
    // not available in Expo Go
  }
}

export const notificationService = {
  registerForPushNotifications,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  scheduleLocalNotification,
};

export default notificationService;
