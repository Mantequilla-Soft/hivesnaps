import { useState, useCallback, useRef, useEffect } from 'react';
import { PrivateKey } from '@hiveio/dhive';
import { getClient } from '../services/HiveClient';
import { accountStorageService } from '../services/AccountStorageService';
import { localAuthService, AuthCancelledError } from '../services/LocalAuthService';
import { hpToVests } from '../utils/hiveCalculations';

const client = getClient();

interface UseWalletOperationsReturn {
    transferLoading: boolean;
    transferSuccess: boolean;
    powerUpLoading: boolean;
    powerUpSuccess: boolean;
    powerDownLoading: boolean;
    powerDownSuccess: boolean;
    transfer: (to: string, amount: string, currency: 'HIVE' | 'HBD', memo: string, manualKey?: string) => Promise<void>;
    powerUp: (amount: string, manualKey?: string) => Promise<void>;
    powerDown: (amountHp: string, globalProps: { total_vesting_fund_hive: string; total_vesting_shares: string }, manualKey?: string) => Promise<void>;
    cancelPowerDown: (manualKey?: string) => Promise<void>;
    resetOperationSuccess: () => void;
    checkStoredKeyAvailable: () => Promise<boolean>;
    getStoredActiveKey: () => Promise<string | null>;
}

export const useWalletOperations = (
    currentUsername: string | null,
    onRefresh?: () => Promise<void>
): UseWalletOperationsReturn => {
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferSuccess, setTransferSuccess] = useState(false);
    const [powerUpLoading, setPowerUpLoading] = useState(false);
    const [powerUpSuccess, setPowerUpSuccess] = useState(false);
    const [powerDownLoading, setPowerDownLoading] = useState(false);
    const [powerDownSuccess, setPowerDownSuccess] = useState(false);

    const pendingTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    useEffect(() => () => { pendingTimers.current.forEach(clearTimeout); }, []);

    const safeTimeout = (fn: () => void, delay: number): void => {
        const id = setTimeout(() => {
            pendingTimers.current.delete(id);
            fn();
        }, delay);
        pendingTimers.current.add(id);
    };

    /**
     * Check if a stored active key exists (no biometric prompt).
     * Use this on modal open to decide whether to show the key input.
     */
    const checkStoredKeyAvailable = useCallback(async (): Promise<boolean> => {
        if (!currentUsername) return false;
        try {
            if (!(await localAuthService.isAvailable())) return false;
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
            if (!(await localAuthService.isAvailable())) {
                throw new Error('Device authentication unavailable. Please enter your active key manually.');
            }
            await localAuthService.authenticate('Confirm wallet operation');
            return key;
        } catch (err: unknown) {
            if (err instanceof AuthCancelledError) throw err;
            throw err instanceof Error ? err : new Error('Failed to access stored active key.');
        }
    }, [currentUsername]);

    /**
     * Resolve the active key: use stored key (with biometric) if manualKey is not provided.
     * Throws AuthCancelledError if user cancels biometric.
     * Throws Error if neither path yields a valid key.
     */
    const resolveKey = useCallback(async (manualKey?: string): Promise<PrivateKey> => {
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
    }, [getStoredActiveKey]);

    /** Trigger a balance refresh after blockchain confirmation (~3s block time). */
    const scheduleRefresh = (): void => {
        safeTimeout(async () => {
            let retries = 0;
            const poll = async (): Promise<void> => {
                try {
                    await onRefresh?.();
                    return;
                } catch {
                    // ignore poll errors
                }
                retries++;
                if (retries < 4) safeTimeout(poll, 1000);
            };
            poll();
        }, 3000);
    };

    const requireUsername = (): string => {
        if (!currentUsername) throw new Error('Wallet session expired. Please sign in again.');
        return currentUsername;
    };

    const parsePositiveAmount = (raw: string, assetLabel: string): number => {
        const normalized = raw.trim();
        if (!/^\d*\.?\d+$/.test(normalized)) {
            throw new Error(`Invalid ${assetLabel} amount. Please enter a numeric value.`);
        }
        const value = Number.parseFloat(normalized);
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Invalid ${assetLabel} amount. Please enter a value greater than 0.`);
        }
        return value;
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
        const username = requireUsername();
        setTransferLoading(true);
        setTransferSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const formattedAmount = `${parsePositiveAmount(amount, currency).toFixed(3)} ${currency}`;
            await client.broadcast.sendOperations(
                [['transfer', { from: username, to, amount: formattedAmount, memo }]],
                activeKey
            );
            setTransferSuccess(true);
            scheduleRefresh();
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
        const username = requireUsername();
        setPowerUpLoading(true);
        setPowerUpSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const formattedAmount = `${parsePositiveAmount(amount, 'HIVE').toFixed(3)} HIVE`;
            await client.broadcast.sendOperations(
                [['transfer_to_vesting', { from: username, to: username, amount: formattedAmount }]],
                activeKey
            );
            setPowerUpSuccess(true);
            scheduleRefresh();
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
        const username = requireUsername();
        setPowerDownLoading(true);
        setPowerDownSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            const vests = hpToVests(
                parsePositiveAmount(amountHp, 'HP'),
                globalProps.total_vesting_fund_hive,
                globalProps.total_vesting_shares
            );
            const formattedVests = `${vests.toFixed(6)} VESTS`;
            await client.broadcast.sendOperations(
                [['withdraw_vesting', { account: username, vesting_shares: formattedVests }]],
                activeKey
            );
            setPowerDownSuccess(true);
            scheduleRefresh();
        } finally {
            setPowerDownLoading(false);
        }
    };

    /**
     * Cancel an active power down by setting vesting_shares to 0.
     * @param manualKey - active key string if entered manually
     */
    const cancelPowerDown = async (manualKey?: string): Promise<void> => {
        const username = requireUsername();
        setPowerDownLoading(true);
        setPowerDownSuccess(false);
        try {
            const activeKey = await resolveKey(manualKey);
            await client.broadcast.sendOperations(
                [['withdraw_vesting', { account: username, vesting_shares: '0.000000 VESTS' }]],
                activeKey
            );
            setPowerDownSuccess(true);
            scheduleRefresh();
        } finally {
            setPowerDownLoading(false);
        }
    };

    const resetOperationSuccess = useCallback((): void => {
        setTransferSuccess(false);
        setPowerUpSuccess(false);
        setPowerDownSuccess(false);
    }, []);

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
        resetOperationSuccess,
        checkStoredKeyAvailable,
        getStoredActiveKey,
    };
};
