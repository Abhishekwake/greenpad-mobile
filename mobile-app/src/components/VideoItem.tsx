import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { Video as VideoType } from '../services/video.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoItemProps {
  video: VideoType;
  isActive: boolean;
  onBookPress: () => void;
}

const VideoItem: React.FC<VideoItemProps> = ({ video, isActive, onBookPress }) => {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const playIconOpacity = useSharedValue(0);
  const playIconScale = useSharedValue(0.5);

  const isHorizontal = video.type === 'horizontal';
  const isPlaying = status?.isLoaded && status.isPlaying;

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && !isPaused) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive, isPaused]);

  const handlePlaybackStatusUpdate = useCallback((newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    if (newStatus.isLoaded) {
      setIsLoading(false);
    }
  }, []);

  const handleTap = useCallback(() => {
    setIsPaused((prev) => {
      const newPaused = !prev;
      if (newPaused) {
        playIconOpacity.value = withTiming(1, { duration: 150 });
        playIconScale.value = withSpring(1, { damping: 12 });
      } else {
        playIconOpacity.value = withTiming(0, { duration: 150 });
        playIconScale.value = withTiming(0.5, { duration: 150 });
      }
      return newPaused;
    });
  }, [playIconOpacity, playIconScale]);

  const playIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: playIconOpacity.value,
    transform: [{ scale: playIconScale.value }],
  }));

  const videoStyle = isHorizontal
    ? {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH * (9 / 16),
      }
    : {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
      };

  return (
    <View style={styles.container}>
      {isHorizontal && (
        <Image
          source={{ uri: video.thumbnail }}
          style={styles.blurredBackground}
          blurRadius={50}
        />
      )}

      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={[styles.videoContainer, isHorizontal && styles.centeredContainer]}>
          <Video
            ref={videoRef}
            source={{ uri: video.url }}
            style={[styles.video, videoStyle]}
            resizeMode={isHorizontal ? ResizeMode.CONTAIN : ResizeMode.COVER}
            isLooping={true}
            shouldPlay={isActive && !isPaused}
            isMuted={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            posterSource={{ uri: video.thumbnail }}
            usePoster={true}
            posterStyle={styles.poster}
          />

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          <Animated.View style={[styles.playIconContainer, playIconAnimatedStyle]}>
            <View style={styles.playIconBackground}>
              <Ionicons name="play" size={50} color="#FFFFFF" />
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="box-none"
      >
        <View style={styles.contentContainer}>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {video.title}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#FFFFFF" />
              <Text style={styles.location}>{video.location}</Text>
            </View>
            {video.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {video.description}
              </Text>
            ) : null}
          </View>

          <View style={styles.actionsContainer}>
            <Pressable style={styles.actionButton} onPress={onBookPress}>
              <View style={styles.ctaButton}>
                <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                <Text style={styles.ctaText}>Book Similar Setup</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sideActions} pointerEvents="box-none">
        <Pressable style={styles.sideActionButton}>
          <Ionicons name="heart-outline" size={28} color="#FFFFFF" />
          <Text style={styles.sideActionText}>Like</Text>
        </Pressable>
        <Pressable style={styles.sideActionButton}>
          <Ionicons name="share-social-outline" size={28} color="#FFFFFF" />
          <Text style={styles.sideActionText}>Share</Text>
        </Pressable>
        <Pressable style={styles.sideActionButton}>
          <Ionicons name="information-circle-outline" size={28} color="#FFFFFF" />
          <Text style={styles.sideActionText}>Info</Text>
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        {status?.isLoaded && status.durationMillis ? (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(status.positionMillis / status.durationMillis) * 100}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  blurredBackground: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContainer: {
    justifyContent: 'center',
  },
  video: {
    backgroundColor: '#000000',
  },
  poster: {
    resizeMode: 'cover',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playIconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    justifyContent: 'flex-end',
    paddingBottom: 100,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  textContainer: {
    marginRight: 80,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 4,
    opacity: 0.9,
  },
  description: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.85,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 16,
  },
  actionButton: {
    alignSelf: 'flex-start',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 200,
    alignItems: 'center',
    gap: 20,
  },
  sideActionButton: {
    alignItems: 'center',
  },
  sideActionText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
});

export default memo(VideoItem);
