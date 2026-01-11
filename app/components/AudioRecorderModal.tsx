/**
 * Audio Recorder Modal
 * Records audio from microphone for audio snaps
 * Similar to snapio.io experience but for React Native
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface AudioRecorderModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAudioRecorded: (audioBlob: Blob, durationSeconds: number) => void;
}

const MAX_DURATION = 300; // 5 minutes in seconds

const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isVisible,
  onClose,
  onAudioRecorded,
}) => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';

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
          if (__DEV__) console.debug('[AudioRecorder] Cleanup error:', e);
        });
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
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
      console.error('Error starting recording:', error);
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
      const audioBlob = await uriToBlob(uri);
      setAudioBlob(audioBlob);

      recordingRef.current = null;
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setDuration(0);
    setIsPlaying(false);
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch((e) => {
        if (__DEV__) console.debug('[AudioRecorder] Cleanup error:', e);
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
            console.error('Error loading sound:', err);
            Alert.alert('Playback Error', 'Failed to load audio');
          }
        };
        reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          Alert.alert('Playback Error', 'Failed to read audio file');
        };
        reader.readAsDataURL(audioBlob);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error during playback:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  };

  const handleUse = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      onAudioRecorded(audioBlob, duration);
      handleClose();
    } catch (error) {
      console.error('Error using audio:', error);
      Alert.alert('Error', 'Failed to process audio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = async () => {
    if (isRecording) {
      await stopRecording();
    }
    deleteRecording();
    setDuration(0);
    onClose();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const secondaryTextColor = isDark ? '#cccccc' : '#666666';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: bgColor }]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Record Audio Snap
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isUploading}
            style={styles.closeButton}
          >
            <FontAwesome name="times" size={24} color={secondaryTextColor} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Timer Display */}
          <View style={styles.timerSection}>
            <Text style={[styles.timerText, { color: textColor }]}>
              {formatTime(duration)}
            </Text>
            <Text style={[styles.maxDurationText, { color: secondaryTextColor }]}>
              Max: {formatTime(MAX_DURATION)}
            </Text>

            {/* Progress Bar */}
            <View
              style={[
                styles.progressBar,
                { backgroundColor: isDark ? '#333333' : '#e0e0e0' },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(duration / MAX_DURATION) * 100}%`,
                    backgroundColor:
                      duration >= MAX_DURATION
                        ? '#ff4444'
                        : '#0066ff',
                  },
                ]}
              />
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {!audioBlob && !isRecording && (
              <TouchableOpacity
                style={[styles.button, styles.recordButton]}
                onPress={startRecording}
              >
                <FontAwesome name="microphone" size={28} color="white" />
                <Text style={styles.buttonText}>Start Recording</Text>
              </TouchableOpacity>
            )}

            {isRecording && (
              <TouchableOpacity
                style={[styles.button, styles.stopButton]}
                onPress={stopRecording}
              >
                <FontAwesome name="stop" size={28} color="white" />
                <Text style={styles.buttonText}>Stop Recording</Text>
              </TouchableOpacity>
            )}

            {audioBlob && (
              <View style={styles.playbackControls}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.playButton,
                    isUploading && styles.buttonDisabled,
                  ]}
                  onPress={togglePlayback}
                  disabled={isUploading}
                >
                  <FontAwesome
                    name={isPlaying ? 'pause' : 'play'}
                    size={24}
                    color="white"
                  />
                  <Text style={styles.buttonText}>
                    {isPlaying ? 'Pause' : 'Play'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.deleteButton,
                    isUploading && styles.buttonDisabled,
                  ]}
                  onPress={deleteRecording}
                  disabled={isUploading}
                >
                  <FontAwesome name="trash" size={24} color="white" />
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Status */}
          {isRecording && (
            <View style={styles.statusBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.statusText}>Recording...</Text>
            </View>
          )}

          {audioBlob && !isRecording && (
            <View style={styles.statusBadge}>
              <FontAwesome name="check-circle" size={14} color="#4CAF50" />
              <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                Recording Complete
              </Text>
            </View>
          )}
        </View>

        {/* Footer Buttons */}
        <View style={[styles.footer, { borderTopColor: isDark ? '#333333' : '#e0e0e0' }]}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={handleClose}
            disabled={isUploading}
          >
            <Text style={[styles.footerButtonText, { color: secondaryTextColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.footerButton,
              styles.useButton,
              (!audioBlob || isUploading) && styles.buttonDisabled,
            ]}
            onPress={handleUse}
            disabled={!audioBlob || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={[styles.footerButtonText, { color: 'white' }]}>Use Audio</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Convert file URI to Blob
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  maxDurationText: {
    fontSize: 14,
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  recordButton: {
    backgroundColor: '#ff4444',
    width: '80%',
  },
  stopButton: {
    backgroundColor: '#ff4444',
    width: '80%',
  },
  playButton: {
    backgroundColor: '#0066ff',
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: '#999999',
    flex: 1,
    marginLeft: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
  },
  useButton: {
    backgroundColor: '#0066ff',
    marginLeft: 8,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066ff',
  },
});

export default AudioRecorderModal;
