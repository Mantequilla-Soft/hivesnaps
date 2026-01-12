/**
 * AudioPreview Component
 * Displays audio attachment preview in compose screen with remove functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { audioPreviewStyles as styles } from './AudioPreview.styles';

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

export default AudioPreview;
