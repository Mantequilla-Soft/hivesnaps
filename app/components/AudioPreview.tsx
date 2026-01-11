/**
 * AudioPreview Component
 * Displays audio attachment preview in compose screen with remove functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface AudioPreviewColors {
  text: string;
  info: string;
  inputBg: string;
  inputBorder: string;
  button: string;
}

interface AudioPreviewProps {
  /** Whether audio is currently uploading */
  isUploading: boolean;
  /** Callback to remove the audio */
  onRemove: () => void;
  /** Duration of the audio in seconds */
  durationSeconds?: number;
  /** Theme colors */
  colors: AudioPreviewColors;
}

/**
 * Audio preview component showing the attached audio with remove option
 */
const AudioPreview: React.FC<AudioPreviewProps> = ({
  isUploading,
  onRemove,
  durationSeconds = 0,
  colors,
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return (
    <View style={[styles.container, { paddingVertical: 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          Audio
        </Text>
        <TouchableOpacity onPress={onRemove}>
          <Text style={[styles.removeText, { color: colors.info }]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>

      {/* Audio Card */}
      <View style={[
        styles.audioCard,
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.inputBorder,
        }
      ]}>
        <View style={styles.audioCardContent}>
          <FontAwesome
            name="music"
            size={24}
            color={colors.button}
            style={styles.musicIcon}
          />
          <View style={styles.textContainer}>
            <Text style={[styles.readyText, { color: colors.text }]}>
              Audio Snap Ready
            </Text>
            {durationSeconds > 0 && (
              <Text style={[styles.durationText, { color: colors.text }]}>
                {formatDuration(durationSeconds)}
              </Text>
            )}
          </View>
          {!isUploading && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={onRemove}
                style={[
                  styles.removeButton,
                  { backgroundColor: colors.inputBorder }
                ]}
              >
                <Text style={[styles.removeButtonText, { color: colors.text }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Info Text */}
      <Text style={[styles.infoText, { color: colors.text }]}>
        One audio per snap • Max 50 MB
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    marginHorizontal: 16,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  audioCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  audioCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  musicIcon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  readyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  durationText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 8,
  },
});

export default AudioPreview;
