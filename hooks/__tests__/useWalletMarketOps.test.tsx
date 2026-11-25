/**
 * Swap/convert in useWalletOperations: a second tap while one is being
 * prepared or broadcast must not send a second order.
 */
const mockSendOperations = jest.fn();
jest.mock('../../services/HiveClient', () => ({
    getClient: () => ({ broadcast: { sendOperations: (...a: unknown[]) => mockSendOperations(...a) } }),
}));
jest.mock('../../services/AccountStorageService', () => ({ accountStorageService: { getAccountKeys: jest.fn(), getCurrentPostingKey: jest.fn() } }));
jest.mock('../../services/LocalAuthService', () => ({
    localAuthService: { isAvailable: jest.fn(), authenticate: jest.fn() },
    AuthCancelledError: class extends Error {},
}));
jest.mock('@hiveio/dhive', () => ({ PrivateKey: { fromString: jest.fn(() => 'KEY') } }));
let mockResolveHead!: (t: string) => void;
jest.mock('../../services/marketService', () => ({
    fetchHeadTime: jest.fn(() => new Promise((r) => { mockResolveHead = r; })),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useWalletOperations } from '../useWalletOperations';

type Ops = ReturnType<typeof useWalletOperations>;
/** Shape-valid WIF (the key itself is mocked). */
const MANUAL_KEY = '5' + 'K'.repeat(50);

function render(): () => Ops {
    let latest!: Ops;
    const Test = (): null => {
        latest = useWalletOperations('meno');
        return null;
    };
    act(() => { create(React.createElement(Test)); });
    return () => latest;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockSendOperations.mockResolvedValue({ id: 'tx' });
});

it('a second swap tap while the first is preparing sends nothing', async () => {
    const ops = render();
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
        first = ops().swap('HIVE_TO_HBD', '1', 0.035, MANUAL_KEY);
        second = ops().swap('HIVE_TO_HBD', '1', 0.035, MANUAL_KEY);
    });
    expect(ops().marketLoading).toBe(true); // set before the network call, so the button is off
    await act(async () => { mockResolveHead('2026-11-25T00:00:00'); await first; await second; });
    expect(mockSendOperations).toHaveBeenCalledTimes(1);
    const [[ops0]] = mockSendOperations.mock.calls;
    expect(ops0[0][0]).toBe('limit_order_create');
    expect(ops0[0][1]).toEqual(expect.objectContaining({ amount_to_sell: '1.000 HIVE', min_to_receive: '0.035 HBD', fill_or_kill: true }));
    expect(ops().marketLoading).toBe(false);
    expect(ops().marketSuccess).toBe(true);
});

it('allows the next swap once the first has finished, and releases the lock on failure', async () => {
    const ops = render();
    mockSendOperations.mockRejectedValueOnce(new Error('rejected'));
    let p!: Promise<void>;
    act(() => { p = ops().swap('HIVE_TO_HBD', '1', 0.035, MANUAL_KEY); });
    await act(async () => { mockResolveHead('2026-11-25T00:00:00'); await expect(p).rejects.toThrow('rejected'); });
    expect(ops().marketLoading).toBe(false);

    act(() => { p = ops().swap('HIVE_TO_HBD', '1', 0.035, MANUAL_KEY); });
    await act(async () => { mockResolveHead('2026-11-25T00:00:00'); await p; });
    expect(mockSendOperations).toHaveBeenCalledTimes(2);
});

it('refuses a swap with no minimum', async () => {
    const ops = render();
    await expect(ops().swap('HIVE_TO_HBD', '1', 0, MANUAL_KEY)).rejects.toThrow(/market price/);
    expect(mockSendOperations).not.toHaveBeenCalled();
});
