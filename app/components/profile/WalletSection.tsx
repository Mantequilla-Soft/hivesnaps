import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

interface WalletSectionProps {
    isOwnProfile: boolean;
    isWalletAccessible: boolean;
    hive?: number;
    hbd?: number;
    hivePower?: number;
    colors: {
        text: string;
        textSecondary: string;
        bubble: string;
        border: string;
        icon: string;
        button: string;
        buttonText: string;
    };
    /** Render as a half-width card (used when placed side-by-side with PointsSection). */
    halfWidth?: boolean;
}

export const WalletSection: React.FC<WalletSectionProps> = ({
    isOwnProfile,
    isWalletAccessible,
    hive,
    hbd,
    hivePower,
    colors,
    halfWidth,
}) => {
    const router = useRouter();

    if (!isOwnProfile || !isWalletAccessible) return null;

    const rows: { label: string; value: string }[] = [
        { label: 'HIVE', value: hive !== undefined ? hive.toFixed(3) : '–' },
        { label: 'HBD',  value: hbd  !== undefined ? hbd.toFixed(3)  : '–' },
        { label: 'HP',   value: hivePower !== undefined ? hivePower.toFixed(0) : '–' },
    ];

    return (
        <View style={[localStyles.container, halfWidth && localStyles.containerHalfWidth, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
            {/* Header */}
            <View style={localStyles.headerRow}>
                <FontAwesome name="credit-card" size={13} color={colors.textSecondary} />
                <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>WALLET</Text>
            </View>

            {/* Balance rows */}
            {rows.map(({ label, value }) => (
                <View key={label} style={localStyles.balanceRow}>
                    <Text style={[localStyles.balanceLabel, halfWidth && localStyles.balanceLabelCompact, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
                    <Text style={[localStyles.balanceValue, halfWidth && localStyles.balanceValueCompact, { color: colors.text }]}>{value}</Text>
                </View>
            ))}

            {/* Open Wallet button */}
            <TouchableOpacity
                style={[localStyles.walletButton, halfWidth && localStyles.walletButtonCompact, { backgroundColor: colors.button }]}
                onPress={() => router.push('/screens/WalletScreen' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Open wallet"
            >
                <Text style={[localStyles.walletButtonText, { color: colors.buttonText }]} numberOfLines={1}>Open Wallet</Text>
                <FontAwesome name="chevron-right" size={11} color={colors.buttonText} />
            </TouchableOpacity>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    containerHalfWidth: {
        flex: 1,
        marginHorizontal: 0,
        marginBottom: 0,
        padding: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.8,
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    balanceLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    balanceLabelCompact: {
        fontSize: 13,
    },
    balanceValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    balanceValueCompact: {
        fontSize: 13,
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 12,
    },
    walletButtonCompact: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    walletButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
