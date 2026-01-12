/**
 * ProgressBar Component
 * Reusable progress bar for displaying upload/recording progress
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Background color of the bar */
  backgroundColor: string;
  /** Fill color of the progress indicator */
  fillColor: string;
  /** Height of the progress bar */
  height?: number;
  /** Border radius of the progress bar */
  borderRadius?: number;
  /** Show percentage text above the bar */
  showPercentage?: boolean;
  /** Label text to display above the bar */
  label?: string;
  /** Text color for label and percentage */
  textColor?: string;
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
}

/**
 * Progress bar component for upload/recording progress
 * Supports labels, percentage display, and custom styling
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  backgroundColor,
  fillColor,
  height = 4,
  borderRadius = 2,
  showPercentage = false,
  label,
  textColor = '#000000',
  style,
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <View style={[styles.container, style]}>
      {/* Header with label and percentage */}
      {(label || showPercentage) && (
        <View style={styles.header}>
          {label && (
            <Text style={[styles.label, { color: textColor }]}>
              {label}
            </Text>
          )}
          {showPercentage && (
            <Text style={[styles.percentage, { color: textColor }]}>
              {Math.round(clampedProgress)}%
            </Text>
          )}
        </View>
      )}

      {/* Progress bar */}
      <View
        style={[
          styles.barContainer,
          {
            height,
            backgroundColor,
            borderRadius,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: fillColor,
              borderRadius,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '500',
  },
  barContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

export default ProgressBar;
