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

    return (
        <View style={[localStyles.container, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
            {/* Header row */}
            <View style={localStyles.headerRow}>
                <FontAwesome name="credit-card" size={13} color={colors.textSecondary} />
                <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>WALLET</Text>
            </View>

            {/* Balance row — three stacked items */}
            <View style={localStyles.balanceRow}>
                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HIVE</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {hive !== undefined ? hive.toFixed(3) : '–'}
                    </Text>
                </View>

                <View style={[localStyles.divider, { backgroundColor: colors.border }]} />

                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HBD</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {hbd !== undefined ? hbd.toFixed(3) : '–'}
                    </Text>
                </View>

                <View style={[localStyles.divider, { backgroundColor: colors.border }]} />

                <View style={localStyles.balanceItem}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>HP</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {hivePower !== undefined ? hivePower.toFixed(0) : '–'}
                    </Text>
                </View>
            </View>

            {/* Open Wallet button */}
            <TouchableOpacity
                style={[localStyles.walletButton, { backgroundColor: colors.button }]}
                onPress={() => router.push('/screens/WalletScreen' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open wallet"
            >
                <Text style={[localStyles.walletButtonText, { color: colors.buttonText }]}>
                    Open Wallet
                </Text>
                <FontAwesome name="chevron-right" size={11} color={colors.buttonText} />
            </TouchableOpacity>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
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
        alignItems: 'center',
        marginBottom: 14,
    },
    balanceItem: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    balanceLabel: {
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    balanceValue: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 0,
    },
    divider: {
        width: 1,
        height: 32,
        marginHorizontal: 4,
    },
    walletButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 8,
    },
    walletButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
