/**
 * Tests for useWalletData: optional lists keep their last good value when a
 * later load fails, silent reloads reject so callers can retry, and a
 * response for a previous account is dropped.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWalletData, type UseWalletDataReturn } from '../useWalletData';
import { getClient } from '../../services/HiveClient';

const mockCall = jest.fn();
const mockProps = jest.fn();

const account = (name: string): object => ({
    name,
    balance: '1.000 HIVE',
    hbd_balance: '2.000 HBD',
    vesting_shares: '2000000.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    to_withdraw: 0,
    withdrawn: 0,
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '10.000 HBD',
});

const withdrawal = { request_id: 7, to: 'alice', amount: '5.000 HBD', memo: '', complete: '2026-11-22T00:00:00' };
const delegation = { delegatee: 'bob', vesting_shares: '200000.000000 VESTS', min_delegation_time: '2026-01-01T00:00:00' };

interface Rendered {
    container: { result: UseWalletDataReturn };
    update: (username: string | null) => void;
}

function renderHook(username: string | null): Rendered {
    const container: { result: UseWalletDataReturn } = { result: null as unknown as UseWalletDataReturn };
    const Test = ({ u }: { u: string | null }): null => {
        container.result = useWalletData(u);
        return null;
    };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Test, { u: username })); });
    return {
        container,
        update: (u): void => { act(() => { renderer.update(React.createElement(Test, { u })); }); },
    };
}

const flush = (): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

/** Route RPC calls; `fail` names methods that should reject. */
function routeCalls(fail: string[] = []): void {
    mockCall.mockImplementation(async (method: string, params: unknown[]) => {
        if (fail.includes(method)) throw new Error(`${method} down`);
        if (method === 'get_accounts') return [account((params[0] as string[])[0])];
        if (method === 'get_savings_withdraw_from') return [withdrawal];
        if (method === 'get_vesting_delegations') return [delegation];
        return [];
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockProps.mockResolvedValue({
        total_vesting_fund_hive: '500.000 HIVE',
        total_vesting_shares: '1000000.000000 VESTS',
        hbd_interest_rate: 1500,
        downvote_pool_percent: 2500,
    });
    (getClient as jest.Mock).mockReturnValue({
        database: { call: mockCall, getDynamicGlobalProperties: mockProps },
    });
});

it('loads balances, withdrawals and delegations', async () => {
    routeCalls();
    const { container } = renderHook('alice');
    await act(async () => { await container.result.reload(); });

    expect(container.result.walletData?.savingsHbd).toBe(10);
    expect(container.result.withdrawals?.map((w) => w.requestId)).toEqual([7]);
    expect(container.result.delegations?.[0]).toMatchObject({ delegatee: 'bob', hp: 100 });
    expect(container.result.extrasFailed).toBe(false);
    expect(container.result.loading).toBe(false);
});

it('keeps the last good lists when a later load of them fails, and rejects a silent reload', async () => {
    routeCalls();
    const { container } = renderHook('alice');
    await act(async () => { await container.result.reload(); });

    routeCalls(['get_savings_withdraw_from', 'get_vesting_delegations']);
    let error: unknown;
    await act(async () => {
        await container.result.reload(true).catch((e) => { error = e; });
    });

    expect(error).toBeInstanceOf(Error);
    expect(container.result.extrasFailed).toBe(true);
    expect(container.result.withdrawals?.map((w) => w.requestId)).toEqual([7]);
    expect(container.result.delegations?.map((d) => d.delegatee)).toEqual(['bob']);
    // Balances still updated.
    expect(container.result.walletData).not.toBeNull();
});

it('marks the lists unavailable (null) when they never loaded', async () => {
    routeCalls(['get_vesting_delegations']);
    const { container } = renderHook('alice');
    await act(async () => { await container.result.reload(); });

    expect(container.result.delegations).toBeNull();
    expect(container.result.withdrawals).toHaveLength(1);
    expect(container.result.extrasFailed).toBe(true);
    expect(container.result.loadError).toBeNull();
});

it('reports a balance failure as loadError on a normal load', async () => {
    routeCalls(['get_accounts']);
    const { container } = renderHook('alice');
    await act(async () => { await container.result.reload(); });

    expect(container.result.loadError).toBe('get_accounts down');
    expect(container.result.walletData).toBeNull();
});

it('drops a response for the previous account', async () => {
    let releaseAlice!: () => void;
    mockCall.mockImplementation((method: string, params: unknown[]) => {
        const name = method === 'get_accounts' ? (params[0] as string[])[0] : (params[0] as string);
        const value = method === 'get_accounts' ? [account(name)] : [];
        if (name === 'alice' && method === 'get_accounts') {
            return new Promise((resolve) => { releaseAlice = (): void => resolve(value); });
        }
        return Promise.resolve(value);
    });

    const { container, update } = renderHook('alice');
    let alicePending!: Promise<void>;
    act(() => { alicePending = container.result.reload(); });

    update('carol');
    await act(async () => { await container.result.reload(); });
    expect(container.result.walletData?.hbdBalance).toBe(2);
    const carolData = container.result.walletData;

    await act(async () => { releaseAlice(); await alicePending; });
    await flush();
    expect(container.result.walletData).toBe(carolData);
});
