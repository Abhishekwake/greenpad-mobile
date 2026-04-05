import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { COLORS } from '../constants';

interface Props {
  message?: string;
  subMessage?: string;
}

const SuccessCheckmark: React.FC<Props> = ({
  message = 'Success!',
  subMessage,
}) => {
  const circleScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.3);

  useEffect(() => {
    circleScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    checkOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    checkScale.value = withDelay(
      300,
      withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 12 })
      )
    );
  }, [circleScale, checkOpacity, checkScale]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: interpolate(circleScale.value, [0, 0.5, 1], [0, 0.8, 1], Extrapolation.CLAMP),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.circle, circleStyle]}>
        <Animated.Text style={[styles.check, checkStyle]}>✓</Animated.Text>
      </Animated.View>
      <Text style={styles.message}>{message}</Text>
      {subMessage ? <Text style={styles.sub}>{subMessage}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 32 },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  check: {
    fontSize: 48,
    color: COLORS.white,
    fontWeight: '800',
  },
  message: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
});

export default React.memo(SuccessCheckmark);
