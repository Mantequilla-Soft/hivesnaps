import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import {
    WalletModalShell,
    AmountField,
    ActiveKeyField,
    walletUiStyles as ui,
    type WalletColors,
} from './walletUi';
import { RecipientField, normalizeUsername, type UsernameLookupStatus } from './RecipientField';
import { isAmountValid } from '../../../utils/wallet';

interface TransferModalProps {
    visible: boolean;
    currency: 'HIVE' | 'HBD';
    balance: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    /** Pre-filled values from a scanned payment-request QR. */
    initialTo?: string;
    initialAmount?: string;
    initialMemo?: string;
    onClose: () => void;
    onTransfer: (to: string, amount: string, memo: string, manualKey?: string) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
    visible,
    currency,
    balance,
    hasStoredKey,
    loading,
    success,
    colors,
    initialTo,
    initialAmount,
    initialMemo,
    onClose,
    onTransfer,
}) => {
    const [to, setTo] = useState(initialTo ?? '');
    const [amount, setAmount] = useState(initialAmount ?? '');
    const [memo, setMemo] = useState(initialMemo ?? '');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [lookupStatus, setLookupStatus] = useState<UsernameLookupStatus>('idle');

    useEffect(() => {
        if (visible) {
            // Picks up any new initial values from a fresh QR scan each time
            // the modal (re)opens, rather than only on first mount.
            setTo(initialTo ?? '');
            setAmount(initialAmount ?? '');
            setMemo(initialMemo ?? '');
            setActiveKeyInput('');
            setError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const isValid =
        normalizeUsername(to).length > 0 &&
        lookupStatus !== 'not-found' &&
        isAmountValid(amount, balance) &&
        (hasStoredKey || activeKeyInput.trim().length > 0);

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            await onTransfer(normalizeUsername(to), amount, memo.trim(), hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transfer failed');
        }
    };

    return (
        <WalletModalShell
            visible={visible}
            title={`Transfer ${currency}`}
            term={currency === 'HBD' ? 'hbd' : 'hive'}
            colors={colors}
            loading={loading}
            success={success}
            successText="Transfer sent!"
            error={error}
            confirmLabel="Send"
            confirmDisabled={!isValid}
            onConfirm={handleConfirm}
            onClose={onClose}
        >
            <RecipientField
                colors={colors}
                value={to}
                onChangeText={setTo}
                onStatusChange={setLookupStatus}
                editable={!loading}
            />

            <AmountField
                colors={colors}
                unit={currency}
                available={balance}
                term={currency === 'HBD' ? 'hbd' : 'hive'}
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
            />

            <View style={ui.field}>
                <Text style={[ui.fieldLabel, { color: colors.text }]}>
                    Memo <Text style={{ color: colors.textSecondary }}>(optional)</Text>
                </Text>
                <TextInput
                    style={[ui.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.textSecondary}
                    value={memo}
                    onChangeText={setMemo}
                    editable={!loading}
                />
            </View>

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
