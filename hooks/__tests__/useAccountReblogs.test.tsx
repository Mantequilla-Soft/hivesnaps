/**
 * Tests for useAccountReblogs: keeps only other authors' posts from the
 * account's blog feed, pages with an exclusive cursor (even through pages
 * with no reblogs), and starts over for a different account.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../../services/AvatarService', () => ({ getAvatarImageUrl: (u: string) => `avatar:${u}` }));
jest.mock('@ecency/render-helper', () => ({ catchPostImage: () => null }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAccountReblogs, onlyNewReblogs, REBLOGS_PAGE_SIZE, type UseAccountReblogsResult } from '../useAccountReblogs';
import { getClient } from '../../services/HiveClient';

const mockCall = jest.fn();
const post = (author: string, permlink: string) => ({ author, permlink, created: '2026-11-19T00:00:00', body: '', title: 't' });
/** A full page: `reblogs` other-author posts, padded with the account's own posts. */
const page = (account: string, prefix: string, reblogs: number) =>
    Array.from({ length: REBLOGS_PAGE_SIZE }, (_, i) =>
        i < reblogs ? post(`other${i}`, `${prefix}-${i}`) : post(account, `${prefix}-own-${i}`)
    );

function renderHook(account: string | null): { container: { result: UseAccountReblogsResult }; update: (a: string | null) => void } {
    const container = { result: null as unknown as UseAccountReblogsResult };
    const Test = ({ a }: { a: string | null }): null => {
        container.result = useAccountReblogs(a);
        return null;
    };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Test, { a: account })); });
    return { container, update: (a): void => { act(() => { renderer.update(React.createElement(Test, { a })); }); } };
}

beforeEach(() => {
    jest.clearAllMocks();
    (getClient as jest.Mock).mockReturnValue({ call: mockCall });
});

describe('onlyNewReblogs', () => {
    it('drops the account’s own posts and anything already listed', () => {
        const existing = [post('bob', 'a')];
        const batch = [post('bob', 'a'), post('Alice', 'own'), post('carol', 'c'), post('carol', 'c')];
        expect(onlyNewReblogs('alice', batch, existing).map((p) => p.permlink)).toEqual(['c']);
    });
});

it('loads nothing until asked, then pages with the last item as an exclusive cursor', async () => {
    mockCall
        .mockResolvedValueOnce(page('alice', 'p1', 0)) // a full page with no reblogs
        .mockResolvedValueOnce([post('bob', 'p2-0'), post('alice', 'p2-own')]);
    const { container } = renderHook('alice');
    expect(mockCall).not.toHaveBeenCalled();

    await act(async () => { await container.result.loadMore(); });
    expect(mockCall).toHaveBeenLastCalledWith('bridge', 'get_account_posts', expect.objectContaining({
        sort: 'blog', account: 'alice', limit: REBLOGS_PAGE_SIZE, start_author: '', start_permlink: '',
    }));
    expect(container.result.reblogs).toEqual([]);
    expect(container.result.hasMore).toBe(true);

    await act(async () => { await container.result.loadMore(); });
    expect(mockCall).toHaveBeenLastCalledWith('bridge', 'get_account_posts', expect.objectContaining({
        start_author: 'alice', start_permlink: `p1-own-${REBLOGS_PAGE_SIZE - 1}`,
    }));
    expect(container.result.reblogs.map((p) => p.permlink)).toEqual(['p2-0']);
    expect(container.result.reblogs[0].avatarUrl).toBe('avatar:bob');
    expect(container.result.hasMore).toBe(false);
});

it('reports an error and can retry', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCall.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([post('bob', 'x')]);
    const { container } = renderHook('alice');
    await act(async () => { await container.result.loadMore(); });
    expect(container.result.error).toBeTruthy();

    await act(async () => { await container.result.refresh(); });
    expect(container.result.error).toBeNull();
    expect(container.result.reblogs.map((p) => p.permlink)).toEqual(['x']);
});

it('starts over for a different account and drops the old account’s late response', async () => {
    let resolveAlice!: (v: unknown) => void;
    mockCall.mockImplementationOnce(() => new Promise((r) => { resolveAlice = r; }));
    const { container, update } = renderHook('alice');
    let pending!: Promise<void>;
    act(() => { pending = container.result.loadMore(); });

    update('bob');
    mockCall.mockResolvedValueOnce([post('carol', 'for-bob')]);
    await act(async () => { await container.result.loadMore(); });
    await act(async () => { resolveAlice([post('dave', 'for-alice')]); await pending; });

    expect(container.result.reblogs.map((p) => p.permlink)).toEqual(['for-bob']);
});
