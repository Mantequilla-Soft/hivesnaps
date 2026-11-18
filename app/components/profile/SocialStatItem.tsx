import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface SocialStatItemProps {
    count: number;
    label: string;
    textColor: string;
    onPress?: () => void;
}

/**
 * Reusable social stat component for ProfileScreen
 * Used for displaying follower/following counts
 */
export const SocialStatItem: React.FC<SocialStatItemProps> = ({
    count,
    label,
    textColor,
    onPress,
}) => {
    return (
        <Pressable
            style={({ pressed }) => [styles.socialStatItem, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onPress}
            disabled={!onPress}
            hitSlop={8}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={onPress ? `${count.toLocaleString()} ${label}` : undefined}
            accessibilityHint={onPress ? `Shows the ${label.toLowerCase()} list` : undefined}
        >
            <Text style={[styles.socialStatNumber, { color: textColor }]}>
                {count.toLocaleString()}
            </Text>
            <Text style={[styles.socialStatLabel, { color: textColor }]}>
                {label}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    socialStatItem: {
        alignItems: 'center',
        marginHorizontal: 16,
    },
    socialStatNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    socialStatLabel: {
        fontSize: 14,
    },
});
