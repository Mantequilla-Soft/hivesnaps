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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch((e) => {
                    if (__DEV__) console.debug('[useAudioRecorder] Cleanup error:', e);
                });
            }
        };
    }, []);

    const startRecording = async () => {
        try {
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

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration((prev) => {
                    const newDuration = prev + 1;
                    if (newDuration >= MAX_DURATION) {
                        stopRecording();
                    }
                    return newDuration;
                });
            }, 1000) as unknown as NodeJS.Timeout;
        } catch (error) {
            console.error('[useAudioRecorder] Error starting recording:', error);
            Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current || !isRecording) return;

        try {
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

            recordingRef.current = null;
            setIsRecording(false);
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
            } else if (!soundRef.current) {
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
            } else {
                await soundRef.current.playAsync();
                setIsPlaying(true);
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
