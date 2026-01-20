/**
 * useAudioRecorder Hook
 * Manages audio recording business logic and state
 * Separates recording logic from UI components
 */

import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

const MAX_DURATION = 300; // 5 minutes in seconds

export interface AudioRecorderState {
    isRecording: boolean;
    duration: number;
    audioBlob: Blob | null;
    isPlaying: boolean;
    isUploading: boolean;
}

export interface UseAudioRecorderReturn extends AudioRecorderState {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    deleteRecording: () => void;
    togglePlayback: () => Promise<void>;
    setIsUploading: (uploading: boolean) => void;
    formatTime: (seconds: number) => string;
    maxDuration: number;
    reset: () => void;
}

/**
 * Hook for managing audio recording functionality
 * Handles permissions, recording, playback, and cleanup
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const durationRef = useRef<number>(0);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Stop any active recording
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch((e) => {
                    if (__DEV__) console.debug('[useAudioRecorder] Error stopping recording on unmount:', e);
                });
                recordingRef.current = null;
            }

            // Clear timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Unload sound
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch((e) => {
                    if (__DEV__) console.debug('[useAudioRecorder] Cleanup error:', e);
                });
                soundRef.current = null;
            }
        };
    }, []); // Empty deps - only cleanup on unmount

    const startRecording = async () => {
        try {
            if (__DEV__) console.log('[useAudioRecorder] Starting recording...');
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission Required', 'Microphone permission is required to record audio.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            await recording.startAsync();

            recordingRef.current = recording;
            setIsRecording(true);
            setDuration(0);
            setAudioBlob(null);
            durationRef.current = 0;
            if (__DEV__) console.log('[useAudioRecorder] Recording started, starting timer...');

            // Start timer - updates every second
            timerRef.current = setInterval(() => {
                durationRef.current += 1;
                const newDuration = durationRef.current;

                if (__DEV__) console.log('[useAudioRecorder] Duration update:', newDuration);

                setDuration(newDuration);

                if (newDuration >= MAX_DURATION) {
                    if (__DEV__) console.log('[useAudioRecorder] Max duration reached, stopping...');
                    stopRecording();
                }
            }, 1000) as unknown as NodeJS.Timeout;

            if (__DEV__) console.log('[useAudioRecorder] Timer started');
        } catch (error) {
            console.error('[useAudioRecorder] Error starting recording:', error);
            Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current || !isRecording) return;

        try {
            const finalDuration = durationRef.current;
            if (__DEV__) console.log('[useAudioRecorder] Stopping recording, duration:', finalDuration);
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();

            if (!uri) {
                throw new Error('Failed to get recording URI');
            }

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Read audio file as blob
            const blob = await uriToBlob(uri);
            setAudioBlob(blob);
            if (__DEV__) console.log('[useAudioRecorder] Blob created, size:', blob.size, 'duration:', finalDuration);

            recordingRef.current = null;
            setIsRecording(false);
            // Duration state is preserved - don't reset it
        } catch (error) {
            console.error('[useAudioRecorder] Error stopping recording:', error);
            Alert.alert('Error', 'Failed to stop recording');
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        setDuration(0);
        setIsPlaying(false);
        if (soundRef.current) {
            soundRef.current.unloadAsync().catch((e) => {
                if (__DEV__) console.debug('[useAudioRecorder] Cleanup error:', e);
            });
            soundRef.current = null;
        }
    };

    const togglePlayback = async () => {
        if (!audioBlob) return;

        try {
            if (isPlaying && soundRef.current) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
            } else if (soundRef.current && !isPlaying) {
                // Resume playback
                await soundRef.current.playAsync();
                setIsPlaying(true);
            } else if (!soundRef.current) {
                // Set audio mode for playback - route to speaker on iOS
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                });

                // Convert blob to data URI for playback
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const dataUri = reader.result as string;
                        const sound = new Audio.Sound();
                        await sound.loadAsync({ uri: dataUri });
                        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                            if (status.isLoaded && status.didJustFinish) {
                                setIsPlaying(false);
                            }
                        });
                        await sound.playAsync();
                        soundRef.current = sound;
                        setIsPlaying(true);
                    } catch (err) {
                        console.error('[useAudioRecorder] Error loading sound:', err);
                        Alert.alert('Playback Error', 'Failed to load audio');
                    }
                };
                reader.onerror = () => {
                    const fileError = reader.error;
                    console.error('[useAudioRecorder] FileReader error:', fileError);
                    let errorMessage = 'An unknown error occurred while reading the audio file.';
                    if (fileError && typeof (fileError as { message?: unknown }).message === 'string') {
                        errorMessage = (fileError as { message: string }).message;
                    }
                    Alert.alert('Playback Error', `Failed to read audio file: ${errorMessage}`);
                };
                reader.readAsDataURL(audioBlob);
            }
        } catch (error) {
            console.error('[useAudioRecorder] Error during playback:', error);
            Alert.alert('Playback Error', 'Failed to play audio');
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const reset = () => {
        deleteRecording();
        setDuration(0);
        durationRef.current = 0;
        setIsUploading(false);
    };

    return {
        isRecording,
        duration,
        audioBlob,
        isPlaying,
        isUploading,
        startRecording,
        stopRecording,
        deleteRecording,
        togglePlayback,
        setIsUploading,
        formatTime,
        maxDuration: MAX_DURATION,
        reset,
    };
}

/**
 * Convert file URI to Blob
 */
async function uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
}
