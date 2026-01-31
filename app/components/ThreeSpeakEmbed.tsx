import React, { useEffect } from 'react';
import { View, useColorScheme, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';

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

  // Keep screen awake while 3speak video is displayed
  useKeepAwake();

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
      />
    </View>
  );
};

export default ThreeSpeakEmbed;
