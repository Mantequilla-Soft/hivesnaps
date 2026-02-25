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

import React, { useReducer, useEffect, useCallback } from 'react';
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
import { parseVideoError } from '../../utils/videoErrorParser';

// --- Env / config -------------------------------------------------------------

/**
 * Fallback video used when the Snapie API call fails entirely (network error).
 * Uses a pre-bundled offline.mp4 video shipped with the app for a better UX
 * when the device is offline or the API is unreachable.
 */
const OFFLINE_VIDEO = offlineVideo;

// --- Constants ----------------------------------------------------------------

const CONTAINER_BORDER_RADIUS = 12;

// --- Types --------------------------------------------------------------------

interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

/**
 * Unified video player state that models the actual playback lifecycle.
 * Consolidates metadata, buffering, and fallback state into a single structure.
 */
type VideoPlayerStatus = 'loading' | 'ready' | 'buffering' | 'playing';

interface VideoPlayerState {
  // Metadata from API
  cid: string | null;
  thumbnail: string | null;

  // Playback status
  status: VideoPlayerStatus;

  // Fallback tracking (enforces invariant: useOfflineFallback implies hasTriedFallback)
  useOfflineFallback: boolean;
  hasTriedFallback: boolean;
}

/**
 * Actions for the video player state machine.
 */
type VideoPlayerAction =
  | { type: 'METADATA_LOADING' }
  | { type: 'METADATA_LOADED'; cid: string; thumbnail: string | null }
  | { type: 'METADATA_FAILED' }
  | { type: 'VIDEO_BUFFERING' }
  | { type: 'VIDEO_READY' }
  | { type: 'VIDEO_ERROR_FALLBACK' }
  | { type: 'RESET_FALLBACK' };

/**
 * Reducer that enforces state transitions and invariants.
 */
function videoPlayerReducer(
  state: VideoPlayerState,
  action: VideoPlayerAction
): VideoPlayerState {
  switch (action.type) {
    case 'METADATA_LOADING':
      return {
        cid: null,
        thumbnail: null,
        status: 'loading',
        useOfflineFallback: false,
        hasTriedFallback: false,
      };

    case 'METADATA_LOADED':
      return {
        ...state,
        cid: action.cid,
        thumbnail: action.thumbnail,
        status: 'ready',
        // Reset fallback state when loading new video metadata
        useOfflineFallback: false,
        hasTriedFallback: false,
      };

    case 'METADATA_FAILED':
      // API call failed - use offline video immediately
      return {
        ...state,
        cid: OFFLINE_VIDEO,
        thumbnail: null,
        status: 'ready',
      };

    case 'VIDEO_BUFFERING':
      return {
        ...state,
        status: 'buffering',
      };

    case 'VIDEO_READY':
      return {
        ...state,
        status: 'playing',
      };

    case 'VIDEO_ERROR_FALLBACK':
      // Network error during playback - switch to offline fallback
      // Enforces invariant: useOfflineFallback → hasTriedFallback
      if (!state.hasTriedFallback) {
        return {
          ...state,
          useOfflineFallback: true,
          hasTriedFallback: true,
          status: 'buffering', // Will buffer the fallback video
        };
      }
      return state;

    case 'RESET_FALLBACK':
      return {
        ...state,
        useOfflineFallback: false,
        hasTriedFallback: false,
      };

    default:
      return state;
  }
}

// --- Component ----------------------------------------------------------------

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
  embedUrl,
  isDark,
}) => {
  const theme = useTheme();
  const themeIsDark = isDark ?? theme.isDark;
  const { width, height } = useWindowDimensions();

  const [state, dispatch] = useReducer(videoPlayerReducer, {
    cid: null,
    thumbnail: null,
    status: 'loading',
    useOfflineFallback: false,
    hasTriedFallback: false,
  });

  const [isModalVisible, setIsModalVisible] = React.useState(false);

  // -- Fetch metadata ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      dispatch({ type: 'METADATA_LOADING' });

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
        dispatch({
          type: 'METADATA_LOADED',
          cid: info.cid,
          thumbnail: info.thumbnail,
        });
      } else {
        // Network error or API unavailable - use the bundled offline video
        if (__DEV__) {
          console.warn(
            '[ThreeSpeakEmbed] API failed, using offline fallback video'
          );
        }
        dispatch({ type: 'METADATA_FAILED' });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [embedUrl]);

  // -- Handlers ----------------------------------------------------------------

  const handleThumbnailPress = useCallback(() => {
    if (state.cid) {
      if (__DEV__) {
        console.log(
          '[ThreeSpeakEmbed] Opening video modal for CID:',
          state.cid
        );
      }
      // Let onBuffer callback drive buffering state to avoid race condition
      setIsModalVisible(true);
    }
  }, [state.cid]);

  const handleCloseModal = useCallback(() => {
    if (__DEV__) {
      console.log('[ThreeSpeakEmbed] Closing video modal');
    }
    setIsModalVisible(false);
    // Reset fallback state for next play attempt
    dispatch({ type: 'RESET_FALLBACK' });
  }, []);

  const handleVideoLoad = useCallback(() => {
    if (__DEV__) {
      console.log('[ThreeSpeakEmbed] Video loaded successfully');
    }
    dispatch({ type: 'VIDEO_READY' });
  }, []);

  const handleVideoBuffer = useCallback(
    ({ isBuffering }: { isBuffering: boolean }) => {
      if (isBuffering) {
        dispatch({ type: 'VIDEO_BUFFERING' });
      } else {
        dispatch({ type: 'VIDEO_READY' });
      }
    },
    []
  );

  const handleVideoError = useCallback((err: unknown) => {
    // Parse error safely using utility function
    const { message, isNetworkError, code } = parseVideoError(err);

    if (isNetworkError) {
      // Network error - try offline fallback (reducer enforces hasTriedFallback invariant)
      if (__DEV__) {
        console.log(
          '[ThreeSpeakEmbed] 📡 Network unavailable, using offline video'
        );
      }
      dispatch({ type: 'VIDEO_ERROR_FALLBACK' });
    } else {
      // Non-network error - just log it
      if (__DEV__) {
        console.warn('[ThreeSpeakEmbed] Video playback error:', message);
        if (code !== undefined) {
          console.log('[ThreeSpeakEmbed] Error code:', code);
        }
      }
    }
  }, []);

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
      {state.thumbnail ? (
        <Image
          source={{ uri: state.thumbnail }}
          style={StyleSheet.absoluteFillObject}
          resizeMode='cover'
        />
      ) : null}

      {/* Dark overlay for play button contrast */}
      {state.status !== 'loading' && state.cid ? (
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]} />
      ) : null}

      {/* Loading spinner */}
      {state.status === 'loading' ? (
        <ActivityIndicator
          size='large'
          color={theme.tint}
          style={styles.centered}
        />
      ) : state.cid ? (
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
      accessibilityViewIsModal
      accessible
      accessibilityLabel='Video player modal'
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
        {isModalVisible && state.cid ? (
          <Video
            key={state.useOfflineFallback ? 'offline' : 'online'}
            source={state.useOfflineFallback ? offlineVideo : { uri: state.cid }}
            style={styles.videoPlayer}
            controls
            resizeMode='contain'
            paused={true}
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
        {state.status === 'buffering' ? (
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
