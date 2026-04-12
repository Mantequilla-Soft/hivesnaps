import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'cancel';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  /** Required for primary variant */
  backgroundColor?: string;
  /** Required for primary variant */
  textColor?: string;
  /** Required for secondary/cancel variants */
  borderColor?: string;
  /** Text color for secondary/cancel variants */
  labelColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

/**
 * Full-width labeled action button with loading state.
 * Use for modal actions: Go Live, Cancel, Retry, etc.
 *
 * Variants:
 *  - primary: filled background (pass backgroundColor + textColor)
 *  - secondary: outlined (pass borderColor + labelColor)
 *  - cancel: same as secondary
 */
export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  backgroundColor,
  textColor = '#fff',
  borderColor,
  labelColor,
  accessibilityLabel,
  accessibilityHint,
  style,
}: PrimaryButtonProps) {
  const isOutlined = variant === 'secondary' || variant === 'cancel';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isOutlined
          ? [styles.outlined, borderColor ? { borderColor } : undefined]
          : [styles.filled, backgroundColor ? { backgroundColor } : undefined],
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator size='small' color={isOutlined ? labelColor : textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: isOutlined ? (labelColor ?? '#000') : textColor },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {},
  outlined: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
