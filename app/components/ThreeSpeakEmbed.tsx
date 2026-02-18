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

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Image,
  StyleSheet,
  useColorScheme,
  StatusBar,
} from "react-native";
import Video from "react-native-video";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchThreeSpeakVideoInfo } from "../../services/threeSpeakVideoService";
import { useTheme } from "../../hooks/useTheme";

// --- Env / config -------------------------------------------------------------

/**
 * Fallback HLS URL used when the Snapie API call fails entirely (network error).
 * Set EXPO_PUBLIC_DEFAULT_VIDEO_CID in your .env to a full HTTPS URL:
 *   https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxxx/manifest.m3u8
 */
const DEFAULT_VIDEO_URL: string =
  process.env.EXPO_PUBLIC_DEFAULT_VIDEO_CID ?? "";

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
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === "dark";
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [videoState, setVideoState] = useState<VideoState>({
    cid: null,
    thumbnail: null,
    isLoading: true,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(true);

  // -- Screen Orientation ------------------------------------------------------

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleOrientationChange = async () => {
      if (isModalVisible) {
        // Unlock orientation when video modal opens - allow rotation
        try {
          await ScreenOrientation.unlockAsync();
          if (__DEV__) {
            console.log('[ThreeSpeakEmbed] Orientation unlocked');
          }
        } catch (err) {
          console.warn('[ThreeSpeakEmbed] Failed to unlock orientation:', err);
        }
      } else {
        // Lock back to portrait when modal closes - with a delay to avoid race conditions
        timeoutId = setTimeout(async () => {
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.PORTRAIT_UP
            );
            if (__DEV__) {
              console.log('[ThreeSpeakEmbed] Orientation locked to portrait');
            }
          } catch (err) {
            console.warn('[ThreeSpeakEmbed] Failed to lock orientation:', err);
          }
        }, 300); // Small delay to ensure modal animation completes
      }
    };

    handleOrientationChange();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // If component unmounts while modal is still open, restore portrait orientation
      if (isModalVisible) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(err => {
          console.warn('[ThreeSpeakEmbed] Failed to restore orientation on unmount:', err);
        });
      }
    };
  }, [isModalVisible]);

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
        // Network error or API unavailable - use the fallback video
        console.warn('[ThreeSpeakEmbed] API failed, using fallback:', DEFAULT_VIDEO_URL);
        setVideoState({
          cid: DEFAULT_VIDEO_URL || null,
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
        console.log('[ThreeSpeakEmbed] Opening video modal for CID:', videoState.cid);
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
    [],
  );

  // -- Render: 1:1 thumbnail in feed -------------------------------------------

  const renderThumbnail = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleThumbnailPress}
      style={[
        styles.container,
        {
          backgroundColor: themeIsDark ? "#000" : "#1a1a1a",
        },
      ]}
    >
      {/* Thumbnail image */}
      {videoState.thumbnail ? (
        <Image
          source={{ uri: videoState.thumbnail }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : null}

      {/* Dark overlay for play button contrast */}
      {!videoState.isLoading && videoState.cid ? (
        <View style={styles.overlay} />
      ) : null}

      {/* Loading spinner */}
      {videoState.isLoading ? (
        <ActivityIndicator
          size="large"
          color={theme.tint}
          style={styles.centered}
        />
      ) : videoState.cid ? (
        /* Play button */
        <View style={styles.centered}>
          <View style={styles.playButtonCircle}>
            <Ionicons
              name="play"
              size={36}
              color="#fff"
              style={styles.playIcon}
            />
          </View>
        </View>
      ) : null}

      {/* 3Speak badge */}
      <View style={styles.badge}>
        <Ionicons name="videocam" size={10} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  // -- Render: fullscreen modal player -----------------------------------------

  const renderModal = () => (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      supportedOrientations={[
        "portrait",
        "landscape",
        "landscape-left",
        "landscape-right",
      ]}
      onRequestClose={handleCloseModal}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
        {/* Native video player - fills available space, respecting safe areas */}
        {videoState.cid ? (
          <Video
            source={{ uri: videoState.cid }}
            style={styles.videoPlayer}
            controls
            resizeMode="contain"
            paused={false}
            onLoad={handleVideoLoad}
            onBuffer={handleVideoBuffer}
            onError={(err) => {
              console.warn("[ThreeSpeakEmbed] Video error:", err);
              if (__DEV__) {
                console.log('[ThreeSpeakEmbed] Video error details:', JSON.stringify(err, null, 2));
              }
              setIsVideoBuffering(false);
            }}
            allowsExternalPlayback
            ignoreSilentSwitch="ignore"
            playInBackground={false}
            playWhenInactive={false}
          />
        ) : null}

        {/* Buffering spinner over video */}
        {isVideoBuffering ? (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}

        {/* Close button - top-left, safe area aware */}
        <SafeAreaView style={styles.modalSafeArea} pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleCloseModal}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close video"
          >
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );

  return (
    <>
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
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  centered: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    marginLeft: 4, // optical centering for the play triangle
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#0057ff",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  // -- Modal ------------------------------------------------------------------
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoPlayer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000",
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  closeButton: {
    margin: 12,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default ThreeSpeakEmbed;
