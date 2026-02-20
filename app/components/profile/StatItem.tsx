import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatItemProps {
    label: string;
    value: string | number;
    textColor: string;
    valueColor: string;
}

/**
 * Reusable stat display component for ProfileScreen
 * Used for Reputation, Hive Power, and HBD stats
 */
export const StatItem: React.FC<StatItemProps> = ({
    label,
    value,
    textColor,
    valueColor,
}) => {
    return (
        <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: textColor }]}>{label}</Text>
            <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    statLabel: {
        fontSize: 14,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});
