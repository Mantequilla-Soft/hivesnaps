import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface BaseProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

interface FilledProps extends BaseProps {
  variant?: 'primary';
  backgroundColor: string;
  textColor: string;
  borderColor?: never;
  labelColor?: never;
}

interface OutlinedProps extends BaseProps {
  variant: 'secondary' | 'cancel';
  borderColor: string;
  labelColor: string;
  backgroundColor?: never;
  textColor?: never;
}

type PrimaryButtonProps = FilledProps | OutlinedProps;

/**
 * Full-width labeled action button with loading state.
 * Use for modal actions: Go Live, Cancel, Retry, etc.
 *
 * Variants:
 *  - primary (default): filled — requires backgroundColor + textColor
 *  - secondary / cancel: outlined — requires borderColor + labelColor
 */
export default function PrimaryButton(props: PrimaryButtonProps): React.ReactElement {
  const { label, onPress, disabled = false, loading = false, accessibilityLabel, accessibilityHint, style } = props;

  let foreground: string;
  let background: string | undefined;
  let border: string | undefined;

  if (props.variant === 'secondary' || props.variant === 'cancel') {
    foreground = props.labelColor;
    border = props.borderColor;
    background = undefined;
  } else {
    // variant is 'primary' | undefined — both resolve to FilledProps
    const filled = props as FilledProps;
    foreground = filled.textColor;
    background = filled.backgroundColor;
    border = undefined;
  }

  const isOutlined = props.variant === 'secondary' || props.variant === 'cancel';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        isOutlined
          ? [styles.outlined, border ? { borderColor: border } : undefined]
          : [styles.filled, background ? { backgroundColor: background } : undefined],
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator size='small' color={foreground} />
      ) : (
        <Text style={[styles.label, { color: foreground }]}>
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
