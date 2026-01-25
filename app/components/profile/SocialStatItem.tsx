import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SocialStatItemProps {
    count: number;
    label: string;
    textColor: string;
}

/**
 * Reusable social stat component for ProfileScreen
 * Used for displaying follower/following counts
 */
export const SocialStatItem: React.FC<SocialStatItemProps> = ({
    count,
    label,
    textColor,
}) => {
    return (
        <View style={styles.socialStatItem}>
            <Text style={[styles.socialStatNumber, { color: textColor }]}>
                {count.toLocaleString()}
            </Text>
            <Text style={[styles.socialStatLabel, { color: textColor }]}>
                {label}
            </Text>
        </View>
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
