import React, { useState, useEffect } from 'react';
import { WalletModalShell, AmountField, ActiveKeyField, Callout, StatusAction, type WalletColors } from './walletUi';
import { isAmountValid } from '../../../utils/wallet';

interface PowerDownModalProps {
    visible: boolean;
    ownHivePower: number;
    activePowerDownRate: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onPowerDown: (amountHp: string, manualKey?: string) => Promise<void>;
    onCancelPowerDown: (manualKey?: string) => Promise<void>;
}

export const PowerDownModal: React.FC<PowerDownModalProps> = ({
    visible,
    ownHivePower,
    activePowerDownRate,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onPowerDown,
    onCancelPowerDown,
}) => {
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [lastAction, setLastAction] = useState<'start' | 'cancel'>('start');

    useEffect(() => {
        if (!visible) {
            setAmount('');
            setActiveKeyInput('');
            setError('');
            setLastAction('start');
        }
    }, [visible]);

    const amountNum = parseFloat(amount);
    const weeklyPayout = Number.isFinite(amountNum) && amountNum > 0 ? amountNum / 13 : 0;
    const isPowerDownActive = activePowerDownRate > 0;
    const canAuthenticate = hasStoredKey || activeKeyInput.trim().length > 0;
    const isValid = isAmountValid(amount, ownHivePower) && canAuthenticate;
    const manualKey = (): string | undefined => (hasStoredKey ? undefined : activeKeyInput.trim());

    const handlePowerDown = async (): Promise<void> => {
        setError('');
        setLastAction('start');
        try {
            await onPowerDown(amount, manualKey());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Power down failed');
        }
    };

    const handleCancel = async (): Promise<void> => {
        setError('');
        setLastAction('cancel');
        try {
            await onCancelPowerDown(manualKey());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel power down');
        }
    };

    return (
        <WalletModalShell
            visible={visible}
            title="Power Down"
            term="powerDown"
            colors={colors}
            loading={loading}
            success={success}
            successText={lastAction === 'cancel' ? 'Power down cancelled!' : 'Power down started!'}
            error={error}
            confirmLabel={isPowerDownActive ? 'Update' : 'Start'}
            confirmDisabled={!isValid}
            onConfirm={handlePowerDown}
            onClose={onClose}
        >
            <Callout colors={colors} tone="warning">
                Power down takes 13 weeks. HIVE is paid out weekly in equal installments.
            </Callout>

            {isPowerDownActive && (
                <StatusAction
                    colors={colors}
                    icon="refresh"
                    text={`Power down active — ${activePowerDownRate.toFixed(3)} HP/week`}
                    actionLabel="Cancel Power Down"
                    onAction={handleCancel}
                    disabled={!canAuthenticate || loading}
                />
            )}

            <AmountField
                colors={colors}
                label="Total Amount to Power Down"
                unit="HP"
                available={ownHivePower}
                availableLabel="Available HP"
                term="hp"
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
                hint={weeklyPayout > 0 ? `Weekly payout: ${weeklyPayout.toFixed(3)} HIVE × 13 weeks` : null}
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
