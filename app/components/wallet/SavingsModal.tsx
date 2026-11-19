import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WalletModalShell, AmountField, ActiveKeyField, Callout, type WalletColors } from './walletUi';
import { isAmountValid, COLLECT_INTEREST_HBD } from '../../../utils/wallet';

/**
 * 'collect' deposits a token COLLECT_INTEREST_HBD into HBD savings: Hive
 * has no claim-interest operation, it pays accrued interest whenever the
 * HBD savings balance changes (once 30 days have passed since the last payout).
 */
export type SavingsMode = 'deposit' | 'withdraw' | 'collect';

interface SavingsModalProps {
    visible: boolean;
    mode: SavingsMode;
    initialCurrency?: 'HIVE' | 'HBD';
    liquid: { HIVE: number; HBD: number };
    savings: { HIVE: number; HBD: number };
    hbdInterestRate: number;
    /** Shown in 'collect' mode. */
    pendingHbdInterest?: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onSubmit: (mode: SavingsMode, amount: string, currency: 'HIVE' | 'HBD', manualKey?: string) => Promise<void>;
}

export const SavingsModal: React.FC<SavingsModalProps> = ({
    visible,
    mode,
    initialCurrency = 'HBD',
    liquid,
    savings,
    hbdInterestRate,
    pendingHbdInterest = 0,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onSubmit,
}) => {
    const [currency, setCurrency] = useState<'HIVE' | 'HBD'>(initialCurrency);
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            setCurrency(initialCurrency);
            setAmount('');
            setActiveKeyInput('');
            setError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const isCollect = mode === 'collect';
    const isDeposit = mode === 'deposit';
    const hasKey = hasStoredKey || activeKeyInput.trim().length > 0;
    const available = isDeposit ? liquid[currency] : savings[currency];
    const collectAmount = COLLECT_INTEREST_HBD.toFixed(3);
    const isValid = isCollect
        ? liquid.HBD >= COLLECT_INTEREST_HBD && hasKey
        : isAmountValid(amount, available) && hasKey;

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            await onSubmit(
                mode,
                isCollect ? collectAmount : amount,
                isCollect ? 'HBD' : currency,
                hasStoredKey ? undefined : activeKeyInput.trim()
            );
        } catch (err) {
            const fallback = isCollect ? 'Collecting interest failed' : isDeposit ? 'Deposit failed' : 'Withdrawal failed';
            setError(err instanceof Error ? err.message : fallback);
        }
    };

    if (isCollect) {
        return (
            <WalletModalShell
                visible={visible}
                title="Collect Interest"
                term="savings"
                colors={colors}
                loading={loading}
                success={success}
                successText="Interest collected! It will show in your HBD savings shortly."
                error={error}
                confirmLabel="Collect"
                confirmDisabled={!isValid}
                onConfirm={handleConfirm}
                onClose={onClose}
            >
                <Callout colors={colors}>
                    {`Hive pays your savings interest (about ${pendingHbdInterest.toFixed(3)} HBD) whenever your HBD savings change. ` +
                        `This moves ${collectAmount} HBD from your balance into savings to trigger the payout.`}
                </Callout>
                <ActiveKeyField
                    colors={colors}
                    hasStoredKey={hasStoredKey}
                    value={activeKeyInput}
                    onChangeText={setActiveKeyInput}
                    editable={!loading}
                />
            </WalletModalShell>
        );
    }

    return (
        <WalletModalShell
            visible={visible}
            title={isDeposit ? 'Deposit to Savings' : 'Withdraw from Savings'}
            term="savings"
            colors={colors}
            loading={loading}
            success={success}
            successText={isDeposit ? 'Moved to savings!' : 'Withdrawal started — it arrives in 3 days.'}
            error={error}
            confirmLabel={isDeposit ? 'Deposit' : 'Withdraw'}
            confirmDisabled={!isValid}
            onConfirm={handleConfirm}
            onClose={onClose}
        >
            {/* Currency toggle */}
            <View style={[styles.toggle, { backgroundColor: colors.bubble }]}>
                {(['HBD', 'HIVE'] as const).map((c) => {
                    const selected = c === currency;
                    return (
                        <Pressable
                            key={c}
                            style={[styles.toggleOption, selected && { backgroundColor: colors.button }]}
                            onPress={() => {
                                setCurrency(c);
                                setAmount('');
                            }}
                            disabled={loading}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                        >
                            <Text style={[styles.toggleText, { color: selected ? colors.buttonText : colors.text }]}>{c}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {isDeposit ? (
                <Callout colors={colors}>
                    {currency === 'HBD'
                        ? `HBD in savings earns about ${hbdInterestRate.toFixed(hbdInterestRate % 1 ? 1 : 0)}% a year. Taking it out later takes 3 days.`
                        : 'HIVE in savings doesn’t earn interest, but it’s protected by a 3-day withdrawal wait.'}
                </Callout>
            ) : (
                <Callout colors={colors} tone="warning">
                    Withdrawals take 3 days to arrive. You can cancel a pending withdrawal from the wallet until then.
                </Callout>
            )}

            <AmountField
                colors={colors}
                unit={currency}
                available={available}
                availableLabel={isDeposit ? `Available ${currency}` : `${currency} in savings`}
                term={currency === 'HBD' ? 'hbd' : 'hive'}
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
            />

            <ActiveKeyField
                colors={colors}
                hasStoredKey={hasStoredKey}
                value={activeKeyInput}
                onChangeText={setActiveKeyInput}
                editable={!loading}
            />
        </WalletModalShell>
    );
};

const styles = StyleSheet.create({
    toggle: { flexDirection: 'row', borderRadius: 8, padding: 3, marginBottom: 14 },
    toggleOption: { flex: 1, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
    toggleText: { fontSize: 14, fontWeight: '600' },
});
