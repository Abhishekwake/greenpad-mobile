import React, { useEffect } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

const AnimatedTextComponent = Animated.createAnimatedComponent(Text);

interface Props {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}

const AnimatedCoinCount: React.FC<Props> = ({
  value,
  duration = 1200,
  style,
  prefix = '',
  suffix = '',
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  const displayValue = useDerivedValue(() => {
    return `${prefix}${Math.round(animatedValue.value).toLocaleString()}${suffix}`;
  });

  const animatedProps = useAnimatedProps(() => {
    return {
      text: displayValue.value,
      defaultValue: displayValue.value,
    } as any;
  });

  return (
    <AnimatedTextComponent
      style={style}
      animatedProps={animatedProps}
    >
      {`${prefix}${value.toLocaleString()}${suffix}`}
    </AnimatedTextComponent>
  );
};

export default React.memo(AnimatedCoinCount);
