import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { WalletModalShell, ActiveKeyField, walletUiStyles as ui, type WalletColors } from './walletUi';
import type { SavingsWithdrawal } from '../../../utils/wallet';

interface CancelWithdrawModalProps {
    withdrawal: SavingsWithdrawal | null;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onConfirm: (requestId: number, manualKey?: string) => Promise<void>;
}

/** Confirms cancelling a pending savings withdrawal (needs the active key). */
export const CancelWithdrawModal: React.FC<CancelWithdrawModalProps> = ({
    withdrawal,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onConfirm,
}) => {
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setActiveKeyInput('');
        setError('');
    }, [withdrawal?.requestId]);

    const handleConfirm = async (): Promise<void> => {
        if (!withdrawal) return;
        setError('');
        try {
            await onConfirm(withdrawal.requestId, hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel withdrawal');
        }
    };

    return (
        <WalletModalShell
            visible={!!withdrawal}
            title="Cancel Withdrawal"
            term="savings"
            colors={colors}
            loading={loading}
            success={success}
            successText="Withdrawal cancelled. The funds stay in savings."
            error={error}
            confirmLabel="Cancel Withdrawal"
            confirmDisabled={!hasStoredKey && !activeKeyInput.trim()}
            onConfirm={handleConfirm}
            onClose={onClose}
        >
            {withdrawal && (
                <Text style={[ui.field, { color: colors.text, fontSize: 14, lineHeight: 20 }]}>
                    Stop withdrawing {withdrawal.amount.toFixed(3)} {withdrawal.currency} from savings? It will stay in your savings balance.
                </Text>
            )}
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
