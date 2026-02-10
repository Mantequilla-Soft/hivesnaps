import React, { useState, useEffect } from 'react';
import { View, useColorScheme, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Video aspect ratio constant - 1:1 square for better preview on vertical screens
const VIDEO_ASPECT_RATIO = 1;

// Border radius for video container
const CONTAINER_BORDER_RADIUS = 12;

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
  embedUrl,
  isDark,
}) => {
  console.log('🎬 [ThreeSpeakEmbed.tsx] FALLBACK version loaded (should NOT be used on iOS!)');
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';
  const { width } = useWindowDimensions();

  // Deactivate keep-awake on unmount to prevent battery drain
  useEffect(() => {
    return () => {
      deactivateKeepAwake('video-playback');
    };
  }, []);

  // Calculate responsive height based on screen width (1:1 square)
  const containerWidth = width - 32;
  const videoHeight = containerWidth;

  return (
    <View
      style={{
        width: '100%',
        height: videoHeight,
        borderRadius: CONTAINER_BORDER_RADIUS,
        overflow: 'hidden',
      }}
    >
      <WebView
        source={{ uri: embedUrl }}
        style={{ flex: 1 }}
        allowsFullscreenVideo={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="compatibility"
        injectedJavaScript={`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              video.addEventListener('play', () => {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'video-play' }));
              });
              video.addEventListener('pause', () => {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'video-pause' }));
              });
              video.addEventListener('ended', () => {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'video-pause' }));
              });
            }
          })();
          true;
        `}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'video-play') {
              activateKeepAwakeAsync('video-playback').catch((err) => {
                console.warn('[ThreeSpeakEmbed] Failed to activate keep-awake:', err);
              });
            } else if (data.type === 'video-pause') {
              deactivateKeepAwake('video-playback');
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }}
      />
    </View>
  );
};

export default ThreeSpeakEmbed;
