import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { TermInfo, type WalletColors } from './walletUi';
import type { SavingsWithdrawal } from '../../../utils/wallet';

interface SavingsCardProps {
    colors: WalletColors;
    savingsHive: number;
    savingsHbd: number;
    hbdInterestRate: number;
    pendingHbdInterest: number;
    nextInterestPayout: Date | null;
    /** null when the list hasn't loaded yet. */
    withdrawals: SavingsWithdrawal[] | null;
    /** The last attempt to load withdrawals failed. */
    loadFailed?: boolean;
    onRetry?: () => void;
    onDeposit: () => void;
    onWithdraw: () => void;
    onCancelWithdrawal: (w: SavingsWithdrawal) => void;
}

const formatDate = (d: Date): string =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const SavingsCard: React.FC<SavingsCardProps> = ({
    colors,
    savingsHive,
    savingsHbd,
    hbdInterestRate,
    pendingHbdInterest,
    nextInterestPayout,
    withdrawals,
    loadFailed,
    onRetry,
    onDeposit,
    onWithdraw,
    onCancelWithdrawal,
}) => {
    const hasSavings = savingsHive > 0 || savingsHbd > 0;
    const payoutReady = nextInterestPayout ? nextInterestPayout.getTime() <= Date.now() : false;

    return (
        <View style={[styles.card, { backgroundColor: colors.bubble }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textSecondary }]}>SAVINGS</Text>
                <TermInfo term="savings" color={colors.textSecondary} size={13} />
                {hbdInterestRate > 0 && (
                    <View style={[styles.aprPill, { backgroundColor: colors.infoBoxBackground }]}>
                        <Text style={[styles.aprText, { color: colors.text }]}>
                            {hbdInterestRate.toFixed(hbdInterestRate % 1 ? 1 : 0)}% APR on HBD
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.balances}>
                <View style={styles.balanceItem}>
                    <Text style={[styles.value, { color: colors.text }]}>{savingsHbd.toFixed(3)}</Text>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>HBD</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
                <View style={styles.balanceItem}>
                    <Text style={[styles.value, { color: colors.text }]}>{savingsHive.toFixed(3)}</Text>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>HIVE</Text>
                </View>
            </View>

            {savingsHbd > 0 && (
                <Text style={[styles.interest, { color: colors.textSecondary }]}>
                    Interest earned so far: <Text style={{ color: colors.text, fontWeight: '600' }}>≈ {pendingHbdInterest.toFixed(3)} HBD</Text>
                    {nextInterestPayout
                        ? payoutReady
                            ? '. It’s paid with your next savings deposit or withdrawal.'
                            : `. Paid out after ${formatDate(nextInterestPayout)}.`
                        : ''}
                </Text>
            )}

            {withdrawals === null && loadFailed && (
                <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
                    <Text style={[styles.retryText, { color: colors.textSecondary }]}>
                        Couldn’t load pending withdrawals. <Text style={{ color: colors.button, fontWeight: '600' }}>Retry</Text>
                    </Text>
                </Pressable>
            )}

            {withdrawals && withdrawals.length > 0 && (
                <View style={styles.withdrawals}>
                    <Text style={[styles.subTitle, { color: colors.text }]}>Pending withdrawals</Text>
                    {withdrawals.map((w) => (
                        <View key={w.requestId} style={[styles.withdrawalRow, { borderColor: colors.inputBorder }]}>
                            <FontAwesome name="clock-o" size={14} color={colors.icon} />
                            <View style={styles.withdrawalText}>
                                <Text style={[styles.withdrawalAmount, { color: colors.text }]}>
                                    {w.amount.toFixed(3)} {w.currency}
                                </Text>
                                <Text style={[styles.withdrawalMeta, { color: colors.textSecondary }]}>
                                    {w.complete ? `Arrives ${formatDate(w.complete)}` : 'Pending'}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => onCancelWithdrawal(w)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Cancel withdrawal of ${w.amount.toFixed(3)} ${w.currency}`}
                            >
                                <Text style={[styles.cancelText, { color: colors.error ?? '#E74C3C' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.buttons}>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.button }]}
                    onPress={onDeposit}
                    accessibilityRole="button"
                >
                    <Text style={[styles.buttonText, { color: colors.buttonText }]}>Deposit</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, styles.outline, { borderColor: colors.buttonInactive, opacity: hasSavings ? 1 : 0.5 }]}
                    onPress={onWithdraw}
                    disabled={!hasSavings}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !hasSavings }}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Withdraw</Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 20, marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    title: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
    aprPill: { marginLeft: 'auto', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    aprText: { fontSize: 11, fontWeight: '600' },
    balances: { flexDirection: 'row' },
    balanceItem: { flex: 1, alignItems: 'center' },
    value: { fontSize: 20, fontWeight: 'bold' },
    label: { fontSize: 12, marginTop: 4 },
    divider: { width: 1, marginHorizontal: 8 },
    interest: { fontSize: 13, lineHeight: 18, marginTop: 14 },
    withdrawals: { marginTop: 14, gap: 8 },
    subTitle: { fontSize: 13, fontWeight: '600' },
    withdrawalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
    },
    withdrawalText: { flex: 1 },
    withdrawalAmount: { fontSize: 14, fontWeight: '600' },
    withdrawalMeta: { fontSize: 12, marginTop: 2 },
    cancelText: { fontSize: 13, fontWeight: '600' },
    retry: { marginTop: 14 },
    retryText: { fontSize: 13 },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
    button: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    outline: { borderWidth: 1 },
    buttonText: { fontSize: 14, fontWeight: '600' },
});
