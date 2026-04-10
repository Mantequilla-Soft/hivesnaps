import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type FontAwesomeIconName = ComponentProps<typeof FontAwesome>['name'];

interface InfoRowProps {
    icon: FontAwesomeIconName;
    text: string;
    iconColor: string;
    textColor: string;
    onPress?: () => void;
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
    onPress,
}) => {
    return (
        <View style={styles.infoRow}>
            <FontAwesome name={icon} size={16} color={iconColor} />
            {onPress ? (
                <TouchableOpacity
                    onPress={onPress}
                    accessibilityRole="link"
                    accessibilityLabel={text}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.linkTouchable}
                >
                    <Text style={[styles.infoText, styles.linkText, { color: textColor }]}>{text}</Text>
                </TouchableOpacity>
            ) : (
                <Text style={[styles.infoText, { color: textColor }]}>{text}</Text>
            )}
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
    linkText: {
        textDecorationLine: 'underline',
    },
    linkTouchable: {
        minHeight: 44,
        justifyContent: 'center',
    },
});
