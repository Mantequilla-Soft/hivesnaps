/**
 * Custom IPFS Video Player Component
 * Shows a thumbnail with play button overlay to prevent autoplay
 * Only loads the actual video when user clicks play
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

interface IPFSVideoPlayerProps {
  ipfsUrl: string;
  isDark?: boolean;
}

const IPFSVideoPlayer: React.FC<IPFSVideoPlayerProps> = ({
  ipfsUrl,
  isDark = false,
}) => {
  const [showVideo, setShowVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Keep screen awake while video is playing
  useEffect(() => {
    if (showVideo) {
      useKeepAwake();
    }
  }, [showVideo]);

  const handlePlayPress = () => {
    setIsLoading(true);
    setShowVideo(true);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  if (showVideo) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <WebView
          source={{ uri: ipfsUrl }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          onLoad={handleVideoLoad}
          // For IPFS videos, we'll let them autoplay once user clicks
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
        />
        {/* Loading indicator */}
        {isLoading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <FontAwesome name='spinner' size={32} color='#fff' />
            <Text style={{ color: '#fff', marginTop: 8, fontSize: 14 }}>
              Loading video...
            </Text>
          </View>
        )}
        {/* Video type indicator */}
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
            IPFS
          </Text>
        </View>
      </View>
    );
  }

  // Show thumbnail with play button
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Video thumbnail background */}
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? '#1a1a1a' : '#000',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Video icon background */}
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: 'rgba(255,255,255,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <FontAwesome name='play' size={24} color='#fff' />
        </View>

        {/* Play button */}
        <TouchableOpacity
          onPress={handlePlayPress}
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <FontAwesome
            name='play'
            size={14}
            color='#000'
            style={{ marginRight: 6 }}
          />
          <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
            Play Video
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video type indicator */}
      <View
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
          IPFS
        </Text>
      </View>
    </View>
  );
};

export default IPFSVideoPlayer;
