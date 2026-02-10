import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions, Platform, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Video aspect ratio constant - 1:1 square for better preview on vertical screens
// Works well for both vertical and horizontal videos since playback is fullscreen
const VIDEO_ASPECT_RATIO = 1;

// Border radius for video container
const CONTAINER_BORDER_RADIUS = 12;

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
  embedUrl,
  isDark,
}) => {
  console.log('🎬 [ThreeSpeakEmbed.ios.tsx] iOS-SPECIFIC version loaded');
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const hasPlayedOnce = useRef(false);

  // Deactivate keep-awake on unmount to prevent battery drain
  useEffect(() => {
    return () => {
      deactivateKeepAwake('video-playback');
    };
  }, []);

  // Calculate responsive height based on screen width (1:1 square)
  // Assumes some padding/margins in the parent container
  const containerWidth = width - 32; // Account for horizontal padding
  const videoHeight = containerWidth; // Square aspect ratio

  // Handle play button tap
  const handlePlayButtonPress = () => {
    setShowPlayButton(false);
    // Inject JS to find and click the play button in the 3Speak player
    webViewRef.current?.injectJavaScript(`
      (function() {
        const video = document.querySelector('video');
        if (video) {
          video.play();
        }
        // Also try to find and click any play button in the player UI
        const playButton = document.querySelector('[class*="play"], [aria-label*="play" i], button[class*="control"]');
        if (playButton) {
          playButton.click();
        }
      })();
      true;
    `);
  };

  // JavaScript to auto-trigger fullscreen when video plays and detect fullscreen exit
  // Enhanced to handle both direct video elements and iframes (3Speak player architecture)
  const injectedJavaScript = `
    (function() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const processedVideos = new WeakSet(); // Track videos that already have listeners
      
      // Function to attempt fullscreen on a video element
      function requestFullscreen(video) {
        if (!video) return false;
        
        try {
          // iOS-specific: webkitEnterFullscreen is the reliable method for iOS
          if (isIOS && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
            return true;
          }
          
          // Standard fullscreen APIs (for Android and other platforms)
          if (video.requestFullscreen) {
            video.requestFullscreen();
            return true;
          } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
            return true;
          } else if (video.mozRequestFullScreen) {
            video.mozRequestFullScreen();
            return true;
          } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
            return true;
          }
        } catch (e) {
          console.log('Fullscreen request failed:', e);
        }
        return false;
      }
      
      // Notify React Native when video exits fullscreen
      function setupFullscreenExitDetection(video) {
        if (!video) return;
        
        // iOS fullscreen exit events
        video.addEventListener('webkitendfullscreen', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'fullscreen-exit',
            paused: video.paused
          }));
        });
        
        // Standard fullscreen change events
        document.addEventListener('fullscreenchange', () => {
          if (!document.fullscreenElement) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'fullscreen-exit',
              paused: video.paused
            }));
          }
        });
        
        document.addEventListener('webkitfullscreenchange', () => {
          if (!document.webkitFullscreenElement) {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'fullscreen-exit',
              paused: video.paused
            }));
          }
        });
      }
      
      // Attach listeners to a video element (only once per video)
      function attachVideoListeners(video) {
        if (!video || processedVideos.has(video)) {
          return; // Already processed this video
        }
        
        processedVideos.add(video);
        setupFullscreenExitDetection(video);
        
        // Notify React Native about play/pause events for keep-awake management
        video.addEventListener('play', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'video-play'
          }));
        });
        
        video.addEventListener('pause', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'video-pause'
          }));
        });
        
        video.addEventListener('ended', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'video-pause'
          }));
        });
        
        let isFirstPlay = true;
        video.addEventListener('play', () => {
          if (isFirstPlay) {
            isFirstPlay = false;
            // Wait longer on first play to ensure video is properly rendered
            // This fixes iOS centering/sizing issues on initial fullscreen
            setTimeout(() => {
              // Double-check video has dimensions before going fullscreen
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                requestFullscreen(video);
              } else {
                // If dimensions not ready, wait a bit more
                setTimeout(() => requestFullscreen(video), 200);
              }
            }, 300);
          }
        });
      }
      
      // Check for video in main document
      function checkMainVideo() {
        const video = document.querySelector('video');
        if (video) {
          attachVideoListeners(video);
          // Check if video has loaded dimensions
          return video.videoWidth > 0 && video.videoHeight > 0;
        }
        return false;
      }
      
      // Check for video in iframes (3Speak may use iframe-based player)
      function checkIframeVideos() {
        const iframes = document.querySelectorAll('iframe');
        let foundWithDimensions = false;
        
        iframes.forEach((iframe) => {
          try {
            // Try to access iframe content (will fail for cross-origin)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const video = iframeDoc.querySelector('video');
              if (video) {
                attachVideoListeners(video);
                // Check if video has loaded dimensions
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  foundWithDimensions = true;
                }
              }
            }
          } catch (e) {
            // Cross-origin iframe - cannot access
            // For iOS, the native fullscreen should still work via allowsFullscreenVideo
          }
        });
        
        return foundWithDimensions;
      }
      
      // Poll for video elements with timeout protection
      // Continue polling until video has proper dimensions
      let checks = 0;
      const maxChecks = 50; // 5 seconds max at 100ms interval
      const checkVideo = setInterval(() => {
        const mainReady = checkMainVideo();
        const iframeReady = checkIframeVideos();
        
        // Stop polling when video is found AND has dimensions, or timeout
        if ((mainReady || iframeReady) || ++checks >= maxChecks) {
          clearInterval(checkVideo);
        }
      }, 100);
    })();
    true;
  `;

  return (
    <View
      style={{
        width: '100%',
        height: videoHeight,
        borderRadius: CONTAINER_BORDER_RADIUS,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <WebView
        ref={webViewRef}
        source={{ uri: embedUrl }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={injectedJavaScript}
        // iOS: Remove mediaPlaybackRequiresUserAction to allow programmatic fullscreen
        // iOS: Set allowsInlineMediaPlayback to false to force native fullscreen
        mediaPlaybackRequiresUserAction={Platform.OS === 'ios' ? false : true}
        allowsInlineMediaPlayback={Platform.OS === 'ios' ? false : true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'fullscreen-exit') {
              hasPlayedOnce.current = true;
              // Show play button overlay if video is paused after exiting fullscreen
              if (data.paused) {
                setShowPlayButton(true);
              }
            } else if (data.type === 'video-play') {
              // Activate keep-awake when video starts playing
              activateKeepAwakeAsync('video-playback').catch((err) => {
                console.warn('[ThreeSpeakEmbed] Failed to activate keep-awake:', err);
              });
            } else if (data.type === 'video-pause') {
              // Deactivate keep-awake when video pauses or ends
              deactivateKeepAwake('video-playback');
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }}
        onShouldStartLoadWithRequest={request => {
          // Allow 3Speak URLs (legacy and new play subdomain), block others
          return (
            request.url.includes('3speak.tv') ||
            request.url.includes('3speak.online') ||
            request.url.includes('play.3speak.tv')
          );
        }}
      />
      {/* Custom play button overlay - shown after exiting fullscreen */}
      {showPlayButton && (
        <TouchableOpacity
          style={styles.playButtonOverlay}
          onPress={handlePlayButtonPress}
          activeOpacity={0.8}
        >
          <View style={styles.playButtonContainer}>
            <Ionicons name="play-circle" size={80} color="rgba(255,255,255,0.9)" />
          </View>
        </TouchableOpacity>
      )}
      {/* 3Speak type indicator */}
      <View
        style={[styles.indicator, { backgroundColor: 'rgba(0,123,255,0.8)' }]}
      >
        <Text style={[styles.indicatorText, { color: '#fff' }]}>3SPEAK</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ThreeSpeakEmbed;
