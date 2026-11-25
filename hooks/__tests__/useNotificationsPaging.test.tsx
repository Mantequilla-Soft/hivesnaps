/**
 * Paging continues from the last page the server returned, not from the
 * oldest notification left after mute/settings filtering: a page that is
 * entirely filtered out must not be requested again.
 */
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn() }));
const mutedList = ['spammer'];
jest.mock('../../store/context', () => ({
    useMutedList: () => ({
        mutedList,
        needsRefresh: false,
        setMutedList: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
    }),
    useNotifications: () => ({ setNotificationUnreadCount: jest.fn(), unreadCount: 0 }),
}));
jest.mock('../../services/HiveMuteService', () => ({ fetchMutedList: jest.fn(), didLastMutedListFetchFail: jest.fn() }));
jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../../services/AccountStorageService', () => ({ accountStorageService: {} }));
jest.mock('../../utils/notifications', () => {
    const actual = jest.requireActual('../../utils/notifications');
    return {
        ...actual,
        fetchNotifications: jest.fn(),
        fetchUnreadNotificationState: jest.fn().mockResolvedValue({ lastread: '1970-01-01T00:00:00', unread: 0 }),
    };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useNotifications } from '../useNotifications';
import { fetchNotifications } from '../../utils/notifications';

const page = (fromId: number, voter: string) =>
    Array.from({ length: 50 }, (_, i) => ({
        id: fromId - i,
        type: 'vote',
        score: 0,
        date: '2026-11-20T00:00:00',
        msg: `@${voter} voted on your post ($0.01)`,
        url: '@meno/x',
    }));

it('moves past a page that is entirely muted instead of asking for it again', async () => {
    // Answers by cursor, like bridge.account_notifications' last_id.
    (fetchNotifications as jest.Mock).mockImplementation(async (_account: string, _limit: number, lastId?: number) => {
        if (lastId === undefined) return page(150, 'alice'); // ids 150..101
        if (lastId === 101) return page(100, 'spammer'); // all muted: ids 100..51
        if (lastId === 51) return page(50, 'bob'); // ids 50..1
        return [];
    });

    let latest!: ReturnType<typeof useNotifications>;
    const Test = (): null => { latest = useNotifications('meno'); return null; };
    let r!: ReturnType<typeof create>;
    await act(async () => { r = create(<Test />); });
    expect(latest.notifications).toHaveLength(50);
    const firstVersion = latest.listVersion;
    expect(firstVersion).toBeGreaterThan(0);

    await act(async () => { await latest.loadMore(); });
    expect(latest.notifications).toHaveLength(50); // nothing visible was added
    await act(async () => { await latest.loadMore(); });

    const cursors = (fetchNotifications as jest.Mock).mock.calls.map((c) => c[2]).filter((c) => c !== undefined);
    expect(cursors).toEqual([101, 51]); // the muted page is asked for once, then paging moves on
    expect(latest.notifications).toHaveLength(100);
    expect(latest.listVersion).toBe(firstVersion); // loading more doesn't count as replacing the list
    act(() => r.unmount());
});
