import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions, TouchableOpacity } from 'react-native';
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
    if (__DEV__) {
        console.log('🎬 [ThreeSpeakEmbed.android.tsx] Android-SPECIFIC version loaded');
    }
    const colorScheme = useColorScheme();
    const themeIsDark = isDark ?? colorScheme === 'dark';
    const { width } = useWindowDimensions();
    const webViewRef = useRef<WebView>(null);
    const [showPlayButton, setShowPlayButton] = useState(false);

    // Deactivate keep-awake on unmount to prevent battery drain
    useEffect(() => {
        return () => {
            deactivateKeepAwake();
        };
    }, []);

    // Calculate responsive height based on screen width (1:1 square)
    // Assumes some padding/margins in the parent container
    const containerWidth = width - 32; // Account for horizontal padding
    const videoHeight = containerWidth; // Square aspect ratio

    // Handle play button tap - re-enter fullscreen or play if paused
    const handlePlayButtonPress = () => {
        setShowPlayButton(false);
        // Inject JS to request fullscreen (and play if paused) with error handling
        webViewRef.current?.injectJavaScript(`
            (function() {
                const video = document.querySelector('video');
                if (!video) {
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'fullscreen-error',
                        message: 'Video element not found'
                    }));
                    return;
                }
                
                // If paused, play first
                if (video.paused) {
                    video.play().catch(err => {
                        console.error('Play failed:', err);
                    });
                }
                
                // Request fullscreen with error handling
                setTimeout(() => {
                    let fullscreenPromise = null;
                    
                    if (video.requestFullscreen) {
                        fullscreenPromise = video.requestFullscreen();
                    } else if (video.webkitRequestFullscreen) {
                        fullscreenPromise = video.webkitRequestFullscreen();
                    } else if (video.mozRequestFullScreen) {
                        fullscreenPromise = video.mozRequestFullScreen();
                    }
                    
                    if (fullscreenPromise && typeof fullscreenPromise.catch === 'function') {
                        fullscreenPromise.catch(err => {
                            console.error('Fullscreen request failed:', err);
                            window.ReactNativeWebView?.postMessage(JSON.stringify({
                                type: 'fullscreen-error',
                                message: 'Fullscreen not supported or denied'
                            }));
                        });
                    } else if (!fullscreenPromise) {
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'fullscreen-error',
                            message: 'Fullscreen API not available'
                        }));
                    }
                }, 100);
            })();
            true;
        `);
    };

    // JavaScript to auto-trigger fullscreen when video plays on Android
    const injectedJavaScript = `
        (function() {
            const processedVideos = new WeakSet(); // Track videos that already have listeners
            let fullscreenListenersAdded = false; // Ensure document listeners added only once
            
            // Function to attempt fullscreen on a video element
            function requestFullscreen(video) {
                if (!video) return false;
                
                try {
                    // Standard fullscreen APIs for Android
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                        return true;
                    } else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen();
                        return true;
                    } else if (video.mozRequestFullScreen) {
                        video.mozRequestFullScreen();
                        return true;
                    }
                } catch (e) {
                    console.log('Fullscreen request failed:', e);
                }
                return false;
            }
            
            // Setup document-level fullscreen exit detection (called once)
            function setupDocumentFullscreenListeners() {
                if (fullscreenListenersAdded) return; // Already added
                fullscreenListenersAdded = true;
                
                // Standard fullscreen change events
                document.addEventListener('fullscreenchange', () => {
                    if (!document.fullscreenElement) {
                        const video = document.querySelector('video');
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'fullscreen-exit',
                            paused: video ? video.paused : false
                        }));
                    }
                });
                
                document.addEventListener('webkitfullscreenchange', () => {
                    if (!document.webkitFullscreenElement) {
                        const video = document.querySelector('video');
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'fullscreen-exit',
                            paused: video ? video.paused : false
                        }));
                    }
                });
            }
            
            // Notify React Native when video exits fullscreen
            function setupFullscreenExitDetection(video) {
                if (!video) return;
                
                // Setup document-level listeners once
                setupDocumentFullscreenListeners();
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
                        // Wait for video to be properly rendered before fullscreen
                        setTimeout(() => {
                            // Double-check video has dimensions before going fullscreen
                            if (video.videoWidth > 0 && video.videoHeight > 0) {
                                requestFullscreen(video);
                            } else {
                                // If dimensions not ready, wait a bit more and try again
                                setTimeout(() => {
                                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                                        requestFullscreen(video);
                                    } else {
                                        // Video dimensions still not ready - likely a loading issue
                                        console.error('Video dimensions not available after retries:', {
                                            videoWidth: video.videoWidth,
                                            videoHeight: video.videoHeight,
                                            readyState: video.readyState
                                        });
                                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                                            type: 'fullscreen-error',
                                            message: 'Video dimensions not loaded'
                                        }));
                                    }
                                }, 200);
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
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            const video = iframeDoc.querySelector('video');
                            if (video) {
                                attachVideoListeners(video);
                                if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    foundWithDimensions = true;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('ThreeSpeakEmbed: Unable to access iframe content (likely cross-origin). Video inside iframe may not be detected.', e);
                    }
                });
                
                return foundWithDimensions;
            }
            
            // Poll for video elements with timeout protection
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
                        if (data.type === 'fullscreen-exit') {
                            // Android: Always show overlay after exiting fullscreen.
                            // Unlike the iOS implementation (ThreeSpeakEmbed.ios.tsx), which uses native
                            // fullscreen that typically auto-pauses on exit, Android videos can continue
                            // playing in the WebView without accessible controls after exiting.
                            // The overlay is therefore required to re-enter fullscreen on Android,
                            // regardless of the video's play state. This comment explains the
                            // behavioral difference between platforms; iOS logic lives in its own file.
                            setShowPlayButton(true);
                        } else if (data.type === 'fullscreen-error') {
                            // Fullscreen failed, show overlay again to allow retry
                            console.warn('[ThreeSpeakEmbed] Fullscreen error:', data.message);
                            setShowPlayButton(true);
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
                    try {
                        const parsedUrl = new URL(request.url);
                        const hostname = parsedUrl.hostname.toLowerCase();
                        const allowedHosts = new Set(['3speak.tv', '3speak.online', 'play.3speak.tv']);
                        return allowedHosts.has(hostname);
                    } catch {
                        // If the URL cannot be parsed, block the navigation
                        return false;
                    }
                }}
            />
            {/* Overlay after exiting fullscreen - tap to re-enter fullscreen */}
            {showPlayButton && (
                <TouchableOpacity
                    style={styles.playButtonOverlay}
                    onPress={handlePlayButtonPress}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Play 3Speak video"
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
