import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { PrivateKey } from '@hiveio/dhive';
import { getClient } from '../services/HiveClient';
import { accountStorageService } from '../services/AccountStorageService';
import { localAuthService, AuthCancelledError } from '../services/LocalAuthService';
import { hpToVests } from '../utils/hiveCalculations';

const client = getClient();

export const useWalletOperations = (
    currentUsername: string | null,
    onRefresh?: () => Promise<void>
) => {
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferSuccess, setTransferSuccess] = useState(false);
    const [powerUpLoading, setPowerUpLoading] = useState(false);
    const [powerUpSuccess, setPowerUpSuccess] = useState(false);
    const [powerDownLoading, setPowerDownLoading] = useState(false);
    const [powerDownSuccess, setPowerDownSuccess] = useState(false);

    /**
     * Check if a stored active key exists (no biometric prompt).
     * Use this on modal open to decide whether to show the key input.
     */
    const checkStoredKeyAvailable = useCallback(async (): Promise<boolean> => {
        if (!currentUsername) return false;
        try {
            const keys = await accountStorageService.getAccountKeys(currentUsername);
            return !!(keys?.activeKey?.trim());
        } catch {
            return false;
        }
    }, [currentUsername]);

    /**
     * Retrieve the stored active key with biometric gate.
     * Throws AuthCancelledError if user cancels biometric prompt.
     * Returns null if no stored key is found.
     */
    const getStoredActiveKey = useCallback(async (): Promise<string | null> => {
        if (!currentUsername) return null;
        try {
            const keys = await accountStorageService.getAccountKeys(currentUsername);
            const key = keys?.activeKey?.trim();
            if (!key) return null;
            if (await localAuthService.isAvailable()) {
                await localAuthService.authenticate('Confirm wallet operation');
            }
            return key;
        } catch (err) {
            if (err instanceof AuthCancelledError) throw err;
            return null;
        }
    }, [currentUsername]);

    /**
     * Resolve the active key: use stored key (with biometric) if manualKey is not provided.
     * Throws AuthCancelledError if user cancels biometric.
     * Throws Error if neither path yields a valid key.
     */
    const resolveKey = async (manualKey?: string): Promise<PrivateKey> => {
        const keyStr = manualKey?.trim() || await getStoredActiveKey();
        if (!keyStr) throw new Error('Active key required. Please enter your active key or store one in settings.');
        if (!keyStr.startsWith('5') || keyStr.length < 50) {
            throw new Error('Invalid active key format. Please check your key and try again.');
        }
        try {
            return PrivateKey.fromString(keyStr);
        } catch {
            throw new Error('Invalid active key format. Please check your key and try again.');
        }
    };

    /** Trigger a balance refresh after blockchain confirmation (~3s block time). */
    const scheduleRefresh = (): void => {
        setTimeout(async () => {
            let retries = 0;
            const poll = async (): Promise<void> => {
                try {
                    await onRefresh?.();
                    return;
                } catch {
                    // ignore poll errors
                }
                retries++;
                if (retries < 4) setTimeout(poll, 1000);
            };
            poll();
        }, 3000);
    };

    /**
     * Transfer HIVE or HBD to another account.
     * @param to - recipient username
     * @param amount - amount string (e.g. "10.000")
     * @param currency - 'HIVE' or 'HBD'
     * @param memo - optional memo
     * @param manualKey - active key string if user entered manually (omit if using stored key)
     */
    const transfer = async (
        to: string,
        amount: string,
        currency: 'HIVE' | 'HBD',
        memo: string,
        manualKey?: string
    ): Promise<void> => {
        if (!currentUsername) return;
        setTransferLoading(true);
        setTransferSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const formattedAmount = `${parseFloat(amount).toFixed(3)} ${currency}`;
            await client.broadcast.sendOperations(
                [['transfer', { from: currentUsername, to, amount: formattedAmount, memo }]],
                activeKey
            );
            setTransferSuccess(true);
            scheduleRefresh();
            setTimeout(() => setTransferSuccess(false), 2500);
        } finally {
            setTransferLoading(false);
        }
    };

    /**
     * Power up HIVE to Hive Power (transfer_to_vesting).
     * @param amount - HIVE amount string (e.g. "10.000")
     * @param manualKey - active key string if entered manually
     */
    const powerUp = async (amount: string, manualKey?: string): Promise<void> => {
        if (!currentUsername) return;
        setPowerUpLoading(true);
        setPowerUpSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const formattedAmount = `${parseFloat(amount).toFixed(3)} HIVE`;
            await client.broadcast.sendOperations(
                [['transfer_to_vesting', { from: currentUsername, to: currentUsername, amount: formattedAmount }]],
                activeKey
            );
            setPowerUpSuccess(true);
            scheduleRefresh();
            setTimeout(() => setPowerUpSuccess(false), 2500);
        } finally {
            setPowerUpLoading(false);
        }
    };

    /**
     * Start or update a power down (withdraw_vesting).
     * @param amountHp - HP amount to power down per 13 weeks
     * @param globalProps - dynamic global properties for HP→VESTS conversion
     * @param manualKey - active key string if entered manually
     */
    const powerDown = async (
        amountHp: string,
        globalProps: { total_vesting_fund_hive: string; total_vesting_shares: string },
        manualKey?: string
    ): Promise<void> => {
        if (!currentUsername) return;
        setPowerDownLoading(true);
        setPowerDownSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const vests = hpToVests(
                parseFloat(amountHp),
                globalProps.total_vesting_fund_hive,
                globalProps.total_vesting_shares
            );
            const formattedVests = `${vests.toFixed(6)} VESTS`;
            await client.broadcast.sendOperations(
                [['withdraw_vesting', { account: currentUsername, vesting_shares: formattedVests }]],
                activeKey
            );
            setPowerDownSuccess(true);
            scheduleRefresh();
            setTimeout(() => setPowerDownSuccess(false), 2500);
        } finally {
            setPowerDownLoading(false);
        }
    };

    /**
     * Cancel an active power down by setting vesting_shares to 0.
     * @param manualKey - active key string if entered manually
     */
    const cancelPowerDown = async (manualKey?: string): Promise<void> => {
        if (!currentUsername) return;
        setPowerDownLoading(true);
        setPowerDownSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            await client.broadcast.sendOperations(
                [['withdraw_vesting', { account: currentUsername, vesting_shares: '0.000000 VESTS' }]],
                activeKey
            );
            setPowerDownSuccess(true);
            scheduleRefresh();
            setTimeout(() => setPowerDownSuccess(false), 2500);
        } finally {
            setPowerDownLoading(false);
        }
    };

    return {
        transferLoading,
        transferSuccess,
        powerUpLoading,
        powerUpSuccess,
        powerDownLoading,
        powerDownSuccess,
        transfer,
        powerUp,
        powerDown,
        cancelPowerDown,
        checkStoredKeyAvailable,
        getStoredActiveKey,
    };
};
