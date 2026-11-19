import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { WalletModalShell, AmountField, ActiveKeyField, Callout, StatusAction, walletUiStyles as ui, type WalletColors } from './walletUi';
import { RecipientField, normalizeUsername, type UsernameLookupStatus } from './RecipientField';
import { isAmountValid } from '../../../utils/wallet';

interface DelegateModalProps {
    visible: boolean;
    /** Set when editing an existing delegation. */
    existing?: { delegatee: string; hp: number } | null;
    /** Own HP that isn't delegated or powering down. */
    delegatableHivePower: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onDelegate: (delegatee: string, amountHp: string, manualKey?: string) => Promise<void>;
}

export const DelegateModal: React.FC<DelegateModalProps> = ({
    visible,
    existing,
    delegatableHivePower,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onDelegate,
}) => {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [lookupStatus, setLookupStatus] = useState<UsernameLookupStatus>('idle');
    const [lastAction, setLastAction] = useState<'set' | 'remove'>('set');

    useEffect(() => {
        if (visible) {
            setTo(existing?.delegatee ?? '');
            setAmount(existing ? existing.hp.toFixed(3) : '');
            setActiveKeyInput('');
            setError('');
            setLastAction('set');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const isEdit = !!existing;
    // Changing a delegation replaces it, so what's already delegated to this
    // account counts towards what you can set it to.
    const maxHp = delegatableHivePower + (existing?.hp ?? 0);
    const canAuthenticate = hasStoredKey || activeKeyInput.trim().length > 0;
    // Compare at the 3 decimals the field shows, so an untouched amount isn't
    // treated as a change (the chain value has more precision than that).
    const currentShown = existing ? parseFloat(existing.hp.toFixed(3)) : null;
    const amountNum = parseFloat(amount);
    const unchanged = currentShown !== null && amountNum === currentShown;
    const isValid =
        !unchanged &&
        normalizeUsername(to).length > 0 &&
        lookupStatus !== 'not-found' &&
        isAmountValid(amount, maxHp) &&
        canAuthenticate;
    const manualKey = (): string | undefined => (hasStoredKey ? undefined : activeKeyInput.trim());

    const submit = async (action: 'set' | 'remove'): Promise<void> => {
        setError('');
        setLastAction(action);
        try {
            await onDelegate(normalizeUsername(to), action === 'remove' ? '0' : amount, manualKey());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delegation failed');
        }
    };

    const reducing = currentShown !== null && amountNum < currentShown;

    return (
        <WalletModalShell
            visible={visible}
            title={isEdit ? `Delegation to @${existing!.delegatee}` : 'Delegate Hive Power'}
            term="delegation"
            colors={colors}
            loading={loading}
            success={success}
            successText={
                lastAction === 'remove'
                    ? 'Delegation removed. The HP returns to you in 5 days.'
                    : isEdit
                        ? 'Delegation updated!'
                        : 'Hive Power delegated!'
            }
            error={error}
            confirmLabel={isEdit ? 'Update' : 'Delegate'}
            confirmDisabled={!isValid}
            onConfirm={() => submit('set')}
            onClose={onClose}
        >
            {isEdit ? (
                <StatusAction
                    colors={colors}
                    icon="handshake-o"
                    text={`Currently delegating ${existing!.hp.toFixed(3)} HP`}
                    actionLabel="Remove Delegation"
                    onAction={() => submit('remove')}
                    disabled={!canAuthenticate || loading}
                />
            ) : (
                <Callout colors={colors}>
                    Lend HP to another account. You keep ownership and can remove it any time; removed HP takes 5 days to return.
                </Callout>
            )}

            {isEdit ? null : (
                <RecipientField
                    colors={colors}
                    label="Delegate to"
                    value={to}
                    onChangeText={setTo}
                    onStatusChange={setLookupStatus}
                    editable={!loading}
                />
            )}

            <AmountField
                colors={colors}
                label={isEdit ? 'New amount' : 'Amount'}
                unit="HP"
                available={maxHp}
                availableLabel={isEdit ? 'Up to' : 'Available HP'}
                term="hp"
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
            />
            {reducing ? (
                <Text style={[ui.hintText, { color: colors.textSecondary, marginTop: -8, marginBottom: 14 }]}>
                    Lowering a delegation returns the difference to you after 5 days.
                </Text>
            ) : null}

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
