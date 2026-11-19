import React, { useState, useEffect } from 'react';
import { WalletModalShell, AmountField, ActiveKeyField, Callout, type WalletColors } from './walletUi';
import { isAmountValid } from '../../../utils/wallet';

interface PowerUpModalProps {
    visible: boolean;
    hiveBalance: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onPowerUp: (amount: string, manualKey?: string) => Promise<void>;
}

export const PowerUpModal: React.FC<PowerUpModalProps> = ({
    visible,
    hiveBalance,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onPowerUp,
}) => {
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!visible) {
            setAmount('');
            setActiveKeyInput('');
            setError('');
        }
    }, [visible]);

    const amountNum = parseFloat(amount);
    const isValid = isAmountValid(amount, hiveBalance) && (hasStoredKey || activeKeyInput.trim().length > 0);

    // 1 HIVE ≈ 1 HP (practically true, very slight variation)
    const hpPreview = Number.isFinite(amountNum) && amountNum > 0 ? `≈ ${amountNum.toFixed(3)} HP` : null;

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            await onPowerUp(amount, hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Power up failed');
        }
    };

    return (
        <WalletModalShell
            visible={visible}
            title="Power Up"
            term="powerUp"
            colors={colors}
            loading={loading}
            success={success}
            successText="Powered up!"
            error={error}
            confirmLabel="Power Up"
            confirmDisabled={!isValid}
            onConfirm={handleConfirm}
            onClose={onClose}
        >
            <Callout colors={colors}>
                Convert liquid HIVE to Hive Power. HP earns curation rewards and increases your voting influence.
            </Callout>

            <AmountField
                colors={colors}
                unit="HIVE"
                available={hiveBalance}
                availableLabel="Available HIVE"
                term="hive"
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
                hint={hpPreview}
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
