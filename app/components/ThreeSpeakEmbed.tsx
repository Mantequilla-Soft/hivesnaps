/**
 * ThreeSpeakEmbed — Native 3Speak video player for HiveSnaps.
 *
 * Replaces the old WebView-based players (ThreeSpeakEmbed.ios.tsx +
 * ThreeSpeakEmbed.android.tsx). No more injected JavaScript, no more
 * platform splits.
 *
 * UX flow:
 *   1. Fetches video metadata from the Snapie Player API.
 *   2. Shows a 1:1 square thumbnail with a play button in the feed.
 *   3. On tap -> opens a full-screen Modal with native video player.
 *   4. Native controls handle playback, seek, volume, fullscreen orientation.
 *   5. On error -> falls back to the default fallback video URL from env.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Video from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchThreeSpeakVideoInfo } from '../../services/threeSpeakVideoService';
import { useTheme } from '../../hooks/useTheme';
import { shadowUtilities, palette } from '../../constants/Colors';
import offlineVideo from '../../assets/animation/offline.mp4';

// --- Env / config -------------------------------------------------------------

/**
 * Fallback video used when the Snapie API call fails entirely (network error).
 * Uses a pre-bundled offline.mp4 video shipped with the app for a better UX
 * when the device is offline or the API is unreachable.
 */
const DEFAULT_VIDEO_URL: string =
  process.env.EXPO_PUBLIC_DEFAULT_VIDEO_CID ?? '';
const OFFLINE_VIDEO = offlineVideo;

// --- Constants ----------------------------------------------------------------

const CONTAINER_BORDER_RADIUS = 12;

// --- Types --------------------------------------------------------------------

interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

interface VideoState {
  cid: string | null;
  thumbnail: string | null;
  isLoading: boolean;
}

// --- Component ----------------------------------------------------------------

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
  embedUrl,
  isDark,
}) => {
  const theme = useTheme();
  const themeIsDark = isDark ?? theme.isDark;
  const { width, height } = useWindowDimensions();

  const [videoState, setVideoState] = useState<VideoState>({
    cid: null,
    thumbnail: null,
    isLoading: true,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(true);
  const [useOfflineFallback, setUseOfflineFallback] = useState(false);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);

  // -- Fetch metadata ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setVideoState({ cid: null, thumbnail: null, isLoading: true });

      if (__DEV__) {
        console.log('[ThreeSpeakEmbed] Loading video for embedUrl:', embedUrl);
      }

      const info = await fetchThreeSpeakVideoInfo(embedUrl);

      if (cancelled) return;

      if (info) {
        if (__DEV__) {
          console.log('[ThreeSpeakEmbed] Video info loaded:', {
            cid: info.cid,
            hasThumbnail: !!info.thumbnail,
            views: info.views,
          });
        }
        setVideoState({
          cid: info.cid,
          thumbnail: info.thumbnail,
          isLoading: false,
        });
      } else {
        // Network error or API unavailable - use the bundled offline video
        if (__DEV__) {
          console.warn(
            '[ThreeSpeakEmbed] API failed, using offline fallback video'
          );
        }
        setVideoState({
          cid: OFFLINE_VIDEO,
          thumbnail: null,
          isLoading: false,
        });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [embedUrl]);

  // -- Handlers ----------------------------------------------------------------

  const handleThumbnailPress = useCallback(() => {
    if (videoState.cid) {
      if (__DEV__) {
        console.log(
          '[ThreeSpeakEmbed] Opening video modal for CID:',
          videoState.cid
        );
      }
      setIsVideoBuffering(true);
      setIsModalVisible(true);
    }
  }, [videoState.cid]);

  const handleCloseModal = useCallback(() => {
    if (__DEV__) {
      console.log('[ThreeSpeakEmbed] Closing video modal');
    }
    setIsModalVisible(false);
    // Reset fallback state for next play attempt
    setUseOfflineFallback(false);
    setHasTriedFallback(false);
  }, []);

  const handleVideoLoad = useCallback(() => {
    if (__DEV__) {
      console.log('[ThreeSpeakEmbed] Video loaded successfully');
    }
    setIsVideoBuffering(false);
  }, []);

  const handleVideoBuffer = useCallback(
    ({ isBuffering }: { isBuffering: boolean }) => {
      setIsVideoBuffering(isBuffering);
    },
    []
  );

  const handleVideoError = useCallback(
    (err: unknown) => {
      setIsVideoBuffering(false);

      // Check if this is a network error and we haven't tried the fallback yet
      const errorString = JSON.stringify(err).toLowerCase();
      const isNetworkError =
        errorString.includes('network') ||
        errorString.includes('unknownhost') ||
        errorString.includes('no address') ||
        errorString.includes('connection') ||
        errorString.includes('22001'); // ExoPlayer network error code

      if (isNetworkError && !hasTriedFallback) {
        if (__DEV__) {
          console.log(
            '[ThreeSpeakEmbed] 📡 Network unavailable, using offline video'
          );
        }
        setUseOfflineFallback(true);
        setHasTriedFallback(true);
      } else if (!isNetworkError) {
        // Only log detailed errors for non-network issues
        if (__DEV__) {
          console.warn('[ThreeSpeakEmbed] Video playback error:', err);
          console.log(
            '[ThreeSpeakEmbed] Error details:',
            JSON.stringify(err, null, 2)
          );
        }
      }
    },
    [hasTriedFallback]
  );

  // -- Render: 1:1 thumbnail in feed -------------------------------------------

  const renderThumbnail = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleThumbnailPress}
      accessibilityRole='button'
      accessibilityLabel='Play 3Speak video'
      accessibilityHint='Opens video player'
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      {/* Thumbnail image */}
      {videoState.thumbnail ? (
        <Image
          source={{ uri: videoState.thumbnail }}
          style={StyleSheet.absoluteFillObject}
          resizeMode='cover'
        />
      ) : null}

      {/* Dark overlay for play button contrast */}
      {!videoState.isLoading && videoState.cid ? (
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]} />
      ) : null}

      {/* Loading spinner */}
      {videoState.isLoading ? (
        <ActivityIndicator
          size='large'
          color={theme.tint}
          style={styles.centered}
        />
      ) : videoState.cid ? (
        /* Play button */
        <View style={styles.centered}>
          <View
            style={[
              styles.playButtonCircle,
              { backgroundColor: palette.overlayDark },
            ]}
          >
            <Ionicons
              name='play'
              size={36}
              color={palette.white}
              style={styles.playIcon}
            />
          </View>
        </View>
      ) : null}

      {/* 3Speak badge */}
      <View style={[styles.badge, { backgroundColor: palette.badge3speak }]}>
        <Ionicons name='videocam' size={10} color={palette.white} />
      </View>
    </TouchableOpacity>
  );

  // -- Render: fullscreen modal player -----------------------------------------

  const renderModal = () => (
    <Modal
      visible={isModalVisible}
      animationType='fade'
      supportedOrientations={[
        'portrait',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
      onRequestClose={handleCloseModal}
      statusBarTranslucent
    >
      <SafeAreaView
        style={[
          styles.modalContainer,
          { backgroundColor: palette.shadow },
        ]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        {/* Native video player - only mounted when modal is open to avoid
            background player instances and buffering spinner race conditions */}
        {isModalVisible && videoState.cid ? (
          <Video
            key={`${useOfflineFallback ? 'offline' : 'online'}-${width}x${height}`}
            source={useOfflineFallback ? offlineVideo : { uri: videoState.cid }}
            style={styles.videoPlayer}
            controls
            resizeMode='contain'
            paused={false}
            onLoad={handleVideoLoad}
            onBuffer={handleVideoBuffer}
            onError={handleVideoError}
            allowsExternalPlayback
            ignoreSilentSwitch='ignore'
            playInBackground={false}
            playWhenInactive={false}
          />
        ) : null}

        {/* Buffering spinner over video */}
        {isVideoBuffering ? (
          <View
            style={[
              styles.bufferingOverlay,
              { backgroundColor: palette.overlayMedium },
            ]}
          >
            <ActivityIndicator size='large' color={palette.white} />
          </View>
        ) : null}

        {/* Close button - top-left, safe area aware */}
        <View style={styles.modalSafeArea} pointerEvents='box-none'>
          <TouchableOpacity
            onPress={handleCloseModal}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole='button'
            accessibilityLabel='Close video'
          >
            <Ionicons name='close-circle' size={32} color={palette.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <>
      {isModalVisible && <StatusBar hidden />}
      {renderThumbnail()}
      {renderModal()}
    </>
  );
};

// --- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1, // 1:1 square
    borderRadius: CONTAINER_BORDER_RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    marginLeft: 4, // optical centering for the play triangle
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  // -- Modal ------------------------------------------------------------------
  modalContainer: {
    flex: 1,
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  closeButton: {
    margin: 12,
    alignSelf: 'flex-start',
    ...shadowUtilities.subtle,
  },
});

export default React.memo(ThreeSpeakEmbed);
