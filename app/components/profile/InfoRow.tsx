import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface InfoRowProps {
    icon: string;
    text: string;
    iconColor: string;
    textColor: string;
}

/**
 * Reusable info row component for ProfileScreen
 * Used for displaying location and website information
 */
export const InfoRow: React.FC<InfoRowProps> = ({
    icon,
    text,
    iconColor,
    textColor,
}) => {
    return (
        <View style={styles.infoRow}>
            <FontAwesome name={icon as any} size={16} color={iconColor} />
            <Text style={[styles.infoText, { color: textColor }]}>{text}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        marginLeft: 8,
        fontSize: 14,
    },
});
