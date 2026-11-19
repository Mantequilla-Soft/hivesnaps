import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '../services/HiveClient';
import {
    parseWalletAccount,
    parseSavingsWithdrawals,
    parseOutgoingDelegations,
    type GlobalVestingProps,
    type OutgoingDelegation,
    type SavingsWithdrawal,
    type WalletData,
} from '../utils/wallet';

// get_vesting_delegations returns at most this many per call.
const DELEGATIONS_LIMIT = 1000;

/** Result of an optional RPC: the parsed list, or a failure marker. */
type Optional<T> = { ok: true; value: T } | { ok: false };

const optional = <T>(promise: Promise<unknown>, parse: (raw: unknown) => T): Promise<Optional<T>> =>
    promise.then(
        (raw): Optional<T> => ({ ok: true, value: parse(raw) }),
        (): Optional<T> => ({ ok: false })
    );

export interface UseWalletDataReturn {
    walletData: WalletData | null;
    globalProps: GlobalVestingProps | null;
    /** null until the first successful load; kept as-is when a later load fails. */
    withdrawals: SavingsWithdrawal[] | null;
    delegations: OutgoingDelegation[] | null;
    /** True when the last attempt to load withdrawals or delegations failed. */
    extrasFailed: boolean;
    loading: boolean;
    refreshing: boolean;
    /** Set when a non-silent load fails (balances couldn't be loaded). */
    loadError: string | null;
    /**
     * Load balances, savings withdrawals and delegations.
     * `silent` refreshes in place and rejects on any failure (including the
     * optional lists) so a caller's retry loop can try again.
     */
    reload: (silent?: boolean) => Promise<void>;
}

/**
 * Wallet balances plus the optional savings-withdrawal and delegation lists.
 * Stale responses (from a previous account or an older request) are dropped.
 * When an optional list fails to load, the last good list is kept rather
 * than replaced with an empty one.
 */
export function useWalletData(username: string | null | undefined): UseWalletDataReturn {
    const [walletData, setWalletData] = useState<WalletData | null>(null);
    const [globalProps, setGlobalProps] = useState<GlobalVestingProps | null>(null);
    const [withdrawals, setWithdrawals] = useState<SavingsWithdrawal[] | null>(null);
    const [delegations, setDelegations] = useState<OutgoingDelegation[] | null>(null);
    const [extrasFailed, setExtrasFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const seqRef = useRef(0);

    // A different account's lists must never show for this one.
    useEffect(() => {
        seqRef.current++;
        setWalletData(null);
        setGlobalProps(null);
        setWithdrawals(null);
        setDelegations(null);
        setExtrasFailed(false);
        setLoadError(null);
    }, [username]);

    const reload = useCallback(
        async (silent = false): Promise<void> => {
            if (!username) {
                seqRef.current++;
                setLoading(false);
                setRefreshing(false);
                return;
            }
            const seq = ++seqRef.current;
            const client = getClient();
            if (silent) setRefreshing(true);
            else {
                setLoading(true);
                setLoadError(null);
            }
            try {
                // Withdrawals and delegations are extras: if either fails the
                // balances still show, and the last good list is kept.
                const withdrawalsP = optional(
                    client.database.call('get_savings_withdraw_from', [username]),
                    parseSavingsWithdrawals
                );
                const delegationsP = optional(
                    client.database.call('get_vesting_delegations', [username, '', DELEGATIONS_LIMIT]),
                    (raw) => raw
                );
                const [accounts, props, w, rawD] = await Promise.all([
                    client.database.call('get_accounts', [[username]]),
                    client.database.getDynamicGlobalProperties(),
                    withdrawalsP,
                    delegationsP,
                ]);
                if (seq !== seqRef.current) return;
                if (!accounts || !accounts[0]) throw new Error('Account not found');

                const gProps: GlobalVestingProps = {
                    total_vesting_fund_hive: props.total_vesting_fund_hive?.toString() ?? '0 HIVE',
                    total_vesting_shares: props.total_vesting_shares?.toString() ?? '0 VESTS',
                };
                const d: Optional<OutgoingDelegation[]> = rawD.ok
                    ? { ok: true, value: parseOutgoingDelegations(rawD.value, gProps) }
                    : { ok: false };

                setGlobalProps(gProps);
                setWalletData(
                    parseWalletAccount(accounts[0], {
                        ...gProps,
                        hbd_interest_rate: props.hbd_interest_rate,
                        downvote_pool_percent: (props as { downvote_pool_percent?: number }).downvote_pool_percent,
                    })
                );
                if (w.ok) setWithdrawals(w.value);
                if (d.ok) setDelegations(d.value);
                const failed = !w.ok || !d.ok;
                setExtrasFailed(failed);
                if (failed && silent) throw new Error('Failed to load savings withdrawals or delegations');
            } catch (err) {
                if (seq !== seqRef.current) return;
                const error = err instanceof Error ? err : new Error('Failed to load wallet');
                if (silent) throw error;
                setLoadError(error.message);
            } finally {
                if (seq === seqRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [username]
    );

    return { walletData, globalProps, withdrawals, delegations, extrasFailed, loading, refreshing, loadError, reload };
}
