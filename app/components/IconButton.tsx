import React, { ComponentProps } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type FontAwesomeIconName = ComponentProps<typeof FontAwesome>['name'];

interface IconButtonProps {
  name: FontAwesomeIconName;
  onPress: () => void;
  size?: number;
  color: string;
  backgroundColor?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Circular icon-only button. hitSlop and accessibilityRole are baked in.
 * Use for header actions: back, create, microphone, search, bell, etc.
 */
export default function IconButton({
  name,
  onPress,
  size = 20,
  color,
  backgroundColor,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        backgroundColor ? { backgroundColor } : undefined,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <FontAwesome name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
