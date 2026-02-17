import React, { useRef } from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

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
    if (__DEV__) {
        console.log('🎬 [ThreeSpeakEmbed.android.tsx] Android-SPECIFIC version loaded');
    }
    const colorScheme = useColorScheme();
    const themeIsDark = isDark ?? colorScheme === 'dark';
    const { width } = useWindowDimensions();
    const webViewRef = useRef<WebView>(null);

    // Calculate responsive height based on screen width (1:1 square)
    const containerWidth = width - 32;
    const videoHeight = containerWidth;

    // Add controls=0 to hide native controls
    const modifiedEmbedUrl = embedUrl.includes('?')
        ? `${embedUrl}&controls=0`
        : `${embedUrl}?controls=0`;

    // Direct video element control (no iframe)
    const injectedJavaScript = `
        (function() {
            if (window.__threespeakInit) return;
            window.__threespeakInit = true;

            const log = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'log', msg }));
            log('🎥 Init');

            let previewOverlay = null;
            let fullscreenOverlay = null;
            let video = null;

            function createOverlay() {
                const o = document.createElement('div');
                o.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;z-index:999999;';
                const b = document.createElement('div');
                b.innerHTML = '▶';
                b.style.cssText = 'width:80px;height:80px;background:rgba(255,255,255,0.9);border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:40px;color:#000;';
                b.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    log('▶️ Clicked');
                    o.style.display = 'none';
                    video.play();
                    setTimeout(() => {
                        if (video.requestFullscreen) video.requestFullscreen();
                        else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
                    }, 100);
                };
                o.appendChild(b);
                return o;
            }

            function setup() {
                video = document.querySelector('video');
                log('Video: ' + !!video);
                if (!video) return;

                const container = video.parentElement;
                container.style.position = 'relative';

                previewOverlay = createOverlay();
                container.appendChild(previewOverlay);
                log('✅ Ready');

                video.onclick = (e) => {
                    const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                    if (fs && !video.paused) {
                        e.preventDefault();
                        e.stopPropagation();
                        video.pause();
                        if (!fullscreenOverlay) {
                            fullscreenOverlay = createOverlay();
                            container.appendChild(fullscreenOverlay);
                        }
                        fullscreenOverlay.style.display = 'flex';
                    }
                };

                const exitFS = () => {
                    if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
                        video.pause();
                        if (fullscreenOverlay) fullscreenOverlay.remove();
                        previewOverlay.style.display = 'flex';
                    }
                };

                document.addEventListener('fullscreenchange', exitFS);
                document.addEventListener('webkitfullscreenchange', exitFS);
            }

            let c = 0;
            const check = setInterval(() => {
                if (document.querySelector('video') || ++c > 20) {
                    clearInterval(check);
                    setup();
                }
            }, 200);
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
                source={{ uri: modifiedEmbedUrl }}
                style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="compatibility"
                injectedJavaScript={injectedJavaScript}
                mediaPlaybackRequiresUserAction={false}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'log') {
                            console.log('[3Speak WebView]', data.msg);
                        }
                    } catch (e) {
                        // Ignore
                    }
                }}
                onShouldStartLoadWithRequest={request => {
                    try {
                        const parsedUrl = new URL(request.url);
                        const hostname = parsedUrl.hostname.toLowerCase();
                        const allowedHosts = new Set(['3speak.tv', '3speak.online', 'play.3speak.tv']);
                        return allowedHosts.has(hostname);
                    } catch {
                        return false;
                    }
                }}
            />
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
});

export default ThreeSpeakEmbed;
