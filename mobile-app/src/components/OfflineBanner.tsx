import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useSharedValue(-60);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Only show banner when the device truly has no network connection.
      // isInternetReachable can be null while still determining — treat null as online.
      const offline = state.isConnected === false;
      setIsOffline(offline);
      translateY.value = offline ? withSpring(0, { damping: 15 }) : withTiming(-60, { duration: 300 });
    });
    return () => unsubscribe();
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { paddingTop: insets.top + 4 }, animatedStyle]}>
      <Ionicons name="cloud-offline" size={16} color="#FFF" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    zIndex: 10000,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default OfflineBanner;
