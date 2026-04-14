import { useState, useCallback, useRef } from 'react';
import { getClient } from '../services/HiveClient';

const client = getClient();

const RELEVANT_OPS = new Set([
    'transfer',
    'transfer_to_vesting',
    'fill_vesting_withdraw',
    'claim_reward_balance',
]);

export type TxOpType =
    | 'transfer'
    | 'transfer_to_vesting'
    | 'fill_vesting_withdraw'
    | 'claim_reward_balance';

export interface TransactionItem {
    id: string;
    type: TxOpType;
    timestamp: string;
    direction?: 'in' | 'out';    // only for transfer
    amount: string;
    secondaryAmount?: string;    // claim_reward_balance has multiple assets
    counterparty?: string;       // the other account
    memo?: string;
}

const parseHistoryEntry = (
    entry: [number, { trx_id: string; timestamp: string; op: [string, Record<string, unknown>] }],
    username: string
): TransactionItem | null => {
    const [index, data] = entry;
    const [opType, opData] = data.op;

    if (!RELEVANT_OPS.has(opType)) return null;

    const id = `${data.trx_id}-${index}`;
    const timestamp = data.timestamp;
    const type = opType as TxOpType;

    switch (type) {
        case 'transfer': {
            const from = opData.from as string;
            const to = opData.to as string;
            const amount = opData.amount as string;
            const memo = opData.memo as string | undefined;
            const isOut = from === username;
            return {
                id, type, timestamp,
                direction: isOut ? 'out' : 'in',
                amount,
                counterparty: isOut ? to : from,
                memo: memo || undefined,
            };
        }
        case 'transfer_to_vesting': {
            const amount = opData.amount as string;
            const from = opData.from as string;
            const to = opData.to as string;
            const isOut = from === username && to === username;
            return {
                id, type, timestamp,
                amount,
                // if powering up for someone else, note that
                counterparty: !isOut ? to : undefined,
            };
        }
        case 'fill_vesting_withdraw': {
            // Virtual op — weekly power-down payout arrives as HIVE
            const deposited = opData.deposited as string;
            return {
                id, type, timestamp,
                direction: 'in',
                amount: deposited,
            };
        }
        case 'claim_reward_balance': {
            const rewardHive = opData.reward_hive as string;
            const rewardHbd = opData.reward_hbd as string;
            const rewardVests = opData.reward_vests as string;
            // Build a readable summary of non-zero rewards
            const parts: string[] = [];
            if (!rewardHive.startsWith('0.000 ')) parts.push(rewardHive);
            if (!rewardHbd.startsWith('0.000 ')) parts.push(rewardHbd);
            if (!rewardVests.startsWith('0.000000 ')) parts.push(rewardVests);
            const amount = parts[0] ?? rewardHive;
            const secondaryAmount = parts.slice(1).join(' + ') || undefined;
            return {
                id, type, timestamp,
                direction: 'in',
                amount,
                secondaryAmount,
            };
        }
        default:
            return null;
    }
};

interface UseAccountHistoryReturn {
    transactions: TransactionItem[];
    loading: boolean;
    error: string | null;
    fetchHistory: () => Promise<void>;
}

export const useAccountHistory = (username: string | null, limit = 10): UseAccountHistoryReturn => {
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchSeq = useRef(0);

    const fetchHistory = useCallback(async (): Promise<void> => {
        if (!username) {
            setTransactions([]);
            setLoading(false);
            setError(null);
            return;
        }
        const seq = ++fetchSeq.current;
        setLoading(true);
        setError(null);
        try {
            // Fetch enough raw ops so filtering yields `limit` results.
            // 50 gives comfortable headroom without hammering the node.
            const raw: [number, { trx_id: string; timestamp: string; op: [string, Record<string, unknown>] }][] =
                await client.database.call('get_account_history', [username, -1, 50]);

            if (seq !== fetchSeq.current) return;

            const parsed: TransactionItem[] = [];
            // History is returned oldest-first; iterate in reverse for newest first
            for (let i = raw.length - 1; i >= 0 && parsed.length < limit; i--) {
                const item = parseHistoryEntry(raw[i], username);
                if (item) parsed.push(item);
            }
            setTransactions(parsed);
        } catch (err) {
            if (seq !== fetchSeq.current) return;
            setError('Could not load transaction history');
        } finally {
            if (seq !== fetchSeq.current) return;
            setLoading(false);
        }
    }, [username, limit]);

    return { transactions, loading, error, fetchHistory };
};
