/**
 * AudioButton Component
 * Reusable button component for audio recorder controls
 * Supports different variants and loading states
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AudioButtonProps {
    /** Callback when button is pressed */
    onPress: () => void;
    /** Button text label */
    text: string;
    /** FontAwesome icon name (optional) */
    icon?: string;
    /** Icon size (optional, defaults to 24) */
    iconSize?: number;
    /** Style variant */
    variant?: ButtonVariant;
    /** Disabled state */
    disabled?: boolean;
    /** Loading state with spinner */
    isLoading?: boolean;
    /** Additional custom styles */
    style?: StyleProp<ViewStyle>;
    /** Additional text styles */
    textStyle?: StyleProp<TextStyle>;
}

/**
 * Reusable button component with icon support and multiple variants
 */
const AudioButton: React.FC<AudioButtonProps> = ({
    onPress,
    text,
    icon,
    iconSize = 24,
    variant = 'primary',
    disabled = false,
    isLoading = false,
    style,
    textStyle,
}) => {
    const buttonStyle: StyleProp<ViewStyle> = [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        variant === 'ghost' && styles.ghostButton,
        (disabled || isLoading) && styles.buttonDisabled,
        style,
    ];

    const textStyleCombined: StyleProp<TextStyle> = [
        styles.buttonText,
        variant === 'primary' && styles.primaryText,
        variant === 'secondary' && styles.secondaryText,
        variant === 'danger' && styles.dangerText,
        variant === 'ghost' && styles.ghostText,
        textStyle,
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled || isLoading}
            activeOpacity={0.7}
        >
            {isLoading ? (
                <ActivityIndicator color="white" size="small" />
            ) : (
                <>
                    {icon && (
                        <FontAwesome
                            name={icon as any}
                            size={iconSize}
                            color="white"
                            style={styles.icon}
                        />
                    )}
                    <Text style={textStyleCombined}>{text}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 8,
    },
    primaryButton: {
        backgroundColor: '#0066ff',
    },
    secondaryButton: {
        backgroundColor: '#999999',
    },
    dangerButton: {
        backgroundColor: '#ff4444',
    },
    ghostButton: {
        backgroundColor: 'transparent',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryText: {
        color: 'white',
    },
    secondaryText: {
        color: 'white',
    },
    dangerText: {
        color: 'white',
    },
    ghostText: {
        color: '#0066ff',
    },
    icon: {
        marginRight: 8,
    },
});

export default AudioButton;
