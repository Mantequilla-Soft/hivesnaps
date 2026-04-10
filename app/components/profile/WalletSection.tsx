import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createProfileScreenStyles } from '../../../styles/ProfileScreenStyles';

interface WalletSectionProps {
    isOwnProfile: boolean;
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
    hive,
    hbd,
    hivePower,
    colors,
}) => {
    const router = useRouter();

    if (!isOwnProfile) return null;

    const fmt = (n?: number): string =>
        n !== undefined ? n.toFixed(3) : '–';

    return (
        <View style={[localStyles.container, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
            <Text style={[localStyles.title, { color: colors.text }]}>Wallet</Text>

            <View style={localStyles.balanceRow}>
                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>{fmt(hive)}</Text>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HIVE</Text>
                </View>
                <View style={[localStyles.divider, { backgroundColor: colors.border }]} />
                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>{fmt(hbd)}</Text>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HBD</Text>
                </View>
                <View style={[localStyles.divider, { backgroundColor: colors.border }]} />
                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>{fmt(hivePower)}</Text>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HP</Text>
                </View>
            </View>

            <TouchableOpacity
                style={[localStyles.walletButton, { backgroundColor: colors.button }]}
                onPress={() => router.push('/screens/WalletScreen' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open wallet"
            >
                <FontAwesome name="credit-card" size={16} color={colors.buttonText} />
                <Text style={[localStyles.walletButtonText, { color: colors.buttonText }]}>Open Wallet</Text>
                <FontAwesome name="chevron-right" size={12} color={colors.buttonText} />
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
    title: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    balanceItem: {
        flex: 1,
        alignItems: 'center',
    },
    balanceValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    balanceLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: 28,
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 8,
    },
    walletButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
