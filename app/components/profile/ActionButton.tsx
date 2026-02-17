import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type FontAwesomeIconName = ComponentProps<typeof FontAwesome>['name'];

interface ActionButtonProps {
    icon: FontAwesomeIconName;
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    backgroundColor: string;
    textColor?: string;
    opacity?: number;
}

/**
 * Reusable action button component for ProfileScreen
 * Used for Follow/Unfollow/Block/Unblock actions
 */
export const ActionButton = React.memo<ActionButtonProps>(({
    icon,
    label,
    onPress,
    loading = false,
    disabled = false,
    backgroundColor,
    textColor = '#fff',
    opacity = 1,
}) => {
    return (
        <TouchableOpacity
            style={[
                styles.actionButton,
                { backgroundColor, opacity: loading || disabled ? 0.6 : opacity },
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            <FontAwesome
                name={loading ? 'hourglass-half' : icon}
                size={16}
                color={textColor}
            />
            <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginHorizontal: 4,
    },
    buttonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
});
