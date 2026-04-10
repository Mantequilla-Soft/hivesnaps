import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createProfileScreenStyles } from '../../../styles/ProfileScreenStyles';

interface WalletSectionProps {
    isOwnProfile: boolean;
    hasActiveKey: boolean;
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
    styles: ReturnType<typeof createProfileScreenStyles>;
}

export const WalletSection: React.FC<WalletSectionProps> = ({
    isOwnProfile,
    hasActiveKey,
    hive,
    hbd,
    hivePower,
    colors,
}) => {
    const router = useRouter();

    if (!isOwnProfile || !hasActiveKey) return null;

    const rows: { label: string; value: string }[] = [
        { label: 'HIVE', value: hive !== undefined ? hive.toFixed(3) : '–' },
        { label: 'HBD',  value: hbd  !== undefined ? hbd.toFixed(3)  : '–' },
        { label: 'HP',   value: hivePower !== undefined ? hivePower.toFixed(0) : '–' },
    ];

    return (
        <View style={[localStyles.container, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
            {/* Header */}
            <View style={localStyles.headerRow}>
                <FontAwesome name="credit-card" size={13} color={colors.textSecondary} />
                <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>WALLET</Text>
            </View>

            {/* Balance rows */}
            {rows.map(({ label, value }) => (
                <View key={label} style={localStyles.balanceRow}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>{label}</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>{value}</Text>
                </View>
            ))}

            {/* Open Wallet button */}
            <TouchableOpacity
                style={[localStyles.walletButton, { backgroundColor: colors.button }]}
                onPress={() => router.push('/screens/WalletScreen' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open wallet"
            >
                <Text style={[localStyles.walletButtonText, { color: colors.buttonText }]}>Open Wallet</Text>
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
    balanceValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 12,
    },
    walletButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
