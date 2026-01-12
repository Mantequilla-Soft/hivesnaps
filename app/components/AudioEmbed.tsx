/**
 * Audio Embed Component
 * Displays 3Speak audio player in minimal mode using WebView
 * 
 * Based on web player strategy:
 * - Fixed height to match 3Speak compact player dimensions
 * - overflow: hidden prevents player from exceeding container
 * - mode=compact&iframe=1 URL parameters for minimal UI
 * - CSS injection to properly size player without clipping
 * - onError callback handles network/loading failures gracefully
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  AUDIO_PLAYER_HEIGHT,
  AUDIO_PLAYER_MARGIN_VERTICAL,
  AUDIO_PLAYER_BORDER_RADIUS
} from '../constants/ui';

interface AudioEmbedProps {
  embedUrl: string;
}

const AudioEmbed: React.FC<AudioEmbedProps> = ({ embedUrl }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Ensure URL has compact mode parameters
  const compactEmbedUrl = embedUrl.includes('mode=compact')
    ? embedUrl
    : `${embedUrl}&mode=compact`;

  const finalEmbedUrl = compactEmbedUrl.includes('iframe=1')
    ? compactEmbedUrl
    : `${compactEmbedUrl}&iframe=1`;

  const handleWebViewError = () => {
    setHasError(true);
    console.warn('[AudioEmbed] Failed to load audio player:', finalEmbedUrl);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  if (hasError) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Unable to load audio player</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      <WebView
        source={{ uri: finalEmbedUrl }}
        style={styles.webview}
        scrollEnabled={false}
        scalesPageToFit={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={true}
        onError={handleWebViewError}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        // Inject CSS to properly size the player without clipping
        injectedJavaScript={`
          (function() {
            function stylePlayers() {
              // Remove all default spacing
              document.documentElement.style.margin = '0';
              document.documentElement.style.padding = '0';
              document.documentElement.style.border = 'none';
              
              document.body.style.margin = '0';
              document.body.style.padding = '0';
              document.body.style.border = 'none';
              
              // Allow body to size naturally but constrain to container width
              document.body.style.width = '100%';
              document.body.style.display = 'flex';
              document.body.style.alignItems = 'center';
              document.body.style.justifyContent = 'center';
              
              // Find and style any player elements
              var players = document.querySelectorAll('[id*="player"], [class*="player"], audio, .audio-player, [role="application"]');
              players.forEach(function(el) {
                el.style.width = '100%';
                el.style.maxWidth = '100%';
                el.style.margin = '0';
                el.style.padding = '0';
              });
            }
            
            // Run on DOMContentLoaded or immediately if already loaded
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', stylePlayers);
            } else {
              stylePlayers();
            }
            
            // Observe for dynamically added player elements
            var observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                  stylePlayers();
                }
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });
            
            true; // Confirm script executed
          })();
        `}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: AUDIO_PLAYER_HEIGHT,
    marginVertical: AUDIO_PLAYER_MARGIN_VERTICAL,
    borderRadius: AUDIO_PLAYER_BORDER_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  errorText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 10,
  },
});

export default AudioEmbed;
