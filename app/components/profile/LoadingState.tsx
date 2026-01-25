import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type FontAwesomeIconName = ComponentProps<typeof FontAwesome>['name'];

interface LoadingStateProps {
    message?: string;
    iconColor: string;
    textColor: string;
    icon?: FontAwesomeIconName;
    iconSize?: number;
}

/**
 * Reusable loading state component
 * Used for displaying loading indicators with messages
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
    message = 'Loading...',
    iconColor,
    textColor,
    icon = 'hourglass-half',
    iconSize = 32,
}) => {
    return (
        <View style={styles.loadingContainer}>
            <FontAwesome
                name={icon}
                size={iconSize}
                color={iconColor}
                style={styles.icon}
            />
            <Text style={[styles.loadingText, { color: textColor }]}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    icon: {
        marginBottom: 8,
    },
    loadingText: {
        fontSize: 14,
        marginTop: 8,
    },
});
