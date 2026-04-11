import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ViewToken,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants';
import GvLogo from '../../components/GvLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = 'greenpad_onboarding_done';

interface Slide {
  id: string;
  /** When set, show emoji like original slides; when omitted, show GV logo. */
  emoji?: string;
  highlight: string;
  bg: string;
  title: string;
  subtitle: string;
  /** Logo width when `emoji` is omitted */
  logoWidth?: number;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '☀️',
    bg: '#059669',
    title: 'Turn Sunshine\ninto Savings',
    subtitle: 'Go solar and save thousands on your electricity bills every year.',
    highlight: '#34D399',
  },
  {
    id: '2',
    emoji: '🤝',
    bg: '#2563EB',
    title: 'Earn While\nYou Empower',
    subtitle: 'Refer friends & family to earn GreenCoins. The more you share, the more you earn!',
    highlight: '#60A5FA',
  },
  {
    id: '3',
    emoji: '🛡️',
    bg: '#7C3AED',
    title: 'Your Trusted\nLocal Partner',
    subtitle: 'Authorized Waaree dealer with 500+ happy installations. Quality guaranteed.',
    highlight: '#A78BFA',
  },
  {
    id: '4',
    bg: '#0f766e',
    title: 'GreenPad\nVentures',
    subtitle: 'Your one place for referrals, GreenCoins, and going solar with confidence.',
    highlight: '#5EEAD4',
    logoWidth: 118,
  },
];

interface SlideItemProps {
  item: Slide;
  index: number;
  scrollX: SharedValue<number>;
}

const SlideItem: React.FC<SlideItemProps> = ({ item, index, scrollX }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.7, 1, 0.7],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }], opacity };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH, backgroundColor: item.bg }]}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        <View style={styles.illustrationWrap}>
          <View style={[styles.illustrationRing, { borderColor: item.highlight }]} />
          {item.emoji != null ? (
            <Text style={styles.illustrationEmoji}>{item.emoji}</Text>
          ) : (
            <View style={styles.logoInRing}>
              <GvLogo width={item.logoWidth ?? 120} />
            </View>
          )}
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );
};

interface DotProps {
  index: number;
  scrollX: SharedValue<number>;
}

const Dot: React.FC<DotProps> = ({ index, scrollX }) => {
  const style = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const width = interpolate(scrollX.value, inputRange, [8, 28, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { width, opacity };
  });

  return <Animated.View style={[styles.dot, style]} />;
};

interface Props {
  onDone: () => void;
}

const OnboardingScreen: React.FC<Props> = ({ onDone }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      onDone();
    }
  }, [currentIndex, onDone]);

  const handleSkip = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  }, [onDone]);

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Animated.FlatList
        ref={flatListRef as any}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SlideItem item={item} index={index} scrollX={scrollX} />
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        <View style={styles.buttonsRow}>
          {!isLast && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, isLast && styles.nextBtnFull]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export { ONBOARDING_KEY };
export default OnboardingScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#059669' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40 },
  illustrationWrap: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  illustrationRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    opacity: 0.4,
  },
  illustrationEmoji: { fontSize: 80 },
  logoInRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  skipText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnFull: {
    flex: 1,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#059669',
  },
});
