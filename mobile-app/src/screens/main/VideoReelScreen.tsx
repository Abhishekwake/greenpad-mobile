import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Text,
  Pressable,
  ViewToken,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import VideoItem from '../../components/VideoItem';
import { videoService, Video } from '../../services/video.service';
import type { MainStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type VideoReelRouteProp = RouteProp<MainStackParamList, 'VideoReels'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const VideoReelScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VideoReelRouteProp>();
  const insets = useSafeAreaInsets();

  const { initialIndex = 0 } = route.params || {};

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const flatListRef = useRef<FlatList>(null);
  const headerOpacity = useSharedValue(1);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await videoService.getVideos();
      setVideos(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBookPress = useCallback(() => {
    navigation.navigate('BookSiteVisit', { mode: 'self' });
  }, [navigation]);

  const renderItem = useCallback(
    ({ item, index }: { item: Video; index: number }) => (
      <VideoItem
        video={item}
        isActive={index === activeIndex}
        onBookPress={handleBookPress}
      />
    ),
    [activeIndex, handleBookPress]
  );

  const keyExtractor = useCallback((item: Video) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Ionicons name="videocam-off-outline" size={64} color="#9CA3AF" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadVideos}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled={true}
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          });
        }}
      />

      <Animated.View
        style={[
          styles.header,
          headerAnimatedStyle,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <Pressable style={styles.headerBackButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Real Installations</Text>
        <View style={styles.headerRight}>
          <Text style={styles.videoCount}>
            {activeIndex + 1}/{videos.length}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  backButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  videoCount: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default VideoReelScreen;
