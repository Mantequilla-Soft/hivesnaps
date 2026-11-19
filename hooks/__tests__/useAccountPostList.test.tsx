/**
 * Tests for useAccountPostList: the reblogs list keeps only other authors'
 * posts from the account's blog feed, the posts list keeps only its own;
 * both page with an exclusive cursor (even through pages with nothing for
 * the list) and start over for a different account or list.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../../services/AvatarService', () => ({ getAvatarImageUrl: (u: string) => `avatar:${u}` }));
jest.mock('@ecency/render-helper', () => ({ catchPostImage: () => null }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
    useAccountPostList,
    onlyNewPosts,
    ACCOUNT_POSTS_PAGE_SIZE,
    type AccountPostKind,
    type UseAccountPostListResult,
} from '../useAccountPostList';
import { getClient } from '../../services/HiveClient';

const mockCall = jest.fn();
const post = (author: string, permlink: string) => ({ author, permlink, created: '2026-11-19T00:00:00', body: '', title: 't' });
/** A full page: `reblogs` other-author posts, padded with the account's own posts. */
const page = (account: string, prefix: string, reblogs: number) =>
    Array.from({ length: ACCOUNT_POSTS_PAGE_SIZE }, (_, i) =>
        i < reblogs ? post(`other${i}`, `${prefix}-${i}`) : post(account, `${prefix}-own-${i}`)
    );

function renderHook(
    account: string | null,
    kind: AccountPostKind = 'reblogs'
): { container: { result: UseAccountPostListResult }; update: (a: string | null, k?: AccountPostKind) => void } {
    const container = { result: null as unknown as UseAccountPostListResult };
    const Test = ({ a, k }: { a: string | null; k: AccountPostKind }): null => {
        container.result = useAccountPostList(a, k);
        return null;
    };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Test, { a: account, k: kind })); });
    return {
        container,
        update: (a, k = kind): void => { act(() => { renderer.update(React.createElement(Test, { a, k })); }); },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    (getClient as jest.Mock).mockReturnValue({ call: mockCall });
});

describe('onlyNewPosts', () => {
    it('reblogs: drops the account’s own posts and anything already listed', () => {
        const existing = [post('bob', 'a')];
        const batch = [post('bob', 'a'), post('Alice', 'own'), post('carol', 'c'), post('carol', 'c')];
        expect(onlyNewPosts('alice', 'reblogs', batch, existing).map((p) => p.permlink)).toEqual(['c']);
    });

    it('posts: keeps only the account’s own posts (case-insensitive), once', () => {
        const existing = [post('alice', 'a')];
        const batch = [post('alice', 'a'), post('Alice', 'b'), post('carol', 'c'), post('Alice', 'b')];
        expect(onlyNewPosts('alice', 'posts', batch, existing).map((p) => p.permlink)).toEqual(['b']);
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
        sort: 'blog', account: 'alice', limit: ACCOUNT_POSTS_PAGE_SIZE, start_author: '', start_permlink: '',
    }));
    expect(container.result.posts).toEqual([]);
    expect(container.result.hasMore).toBe(true);

    await act(async () => { await container.result.loadMore(); });
    expect(mockCall).toHaveBeenLastCalledWith('bridge', 'get_account_posts', expect.objectContaining({
        start_author: 'alice', start_permlink: `p1-own-${ACCOUNT_POSTS_PAGE_SIZE - 1}`,
    }));
    expect(container.result.posts.map((p) => p.permlink)).toEqual(['p2-0']);
    expect(container.result.posts[0].avatarUrl).toBe('avatar:bob');
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
    expect(container.result.posts.map((p) => p.permlink)).toEqual(['x']);
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

    expect(container.result.posts.map((p) => p.permlink)).toEqual(['for-bob']);
});

it('the posts list asks the bridge for the account’s own posts', async () => {
    mockCall.mockResolvedValueOnce([post('alice', 'mine'), post('bob', 'not-mine')]);
    const { container } = renderHook('alice', 'posts');
    await act(async () => { await container.result.loadMore(); });
    expect(mockCall).toHaveBeenLastCalledWith('bridge', 'get_account_posts', expect.objectContaining({
        sort: 'posts', account: 'alice', start_author: '', start_permlink: '',
    }));
    expect(container.result.posts.map((p) => p.permlink)).toEqual(['mine']);
    expect(container.result.hasMore).toBe(false);
});

it('starts over when switched to the other list', async () => {
    mockCall.mockResolvedValueOnce([post('bob', 'reblogged')]).mockResolvedValueOnce([post('alice', 'own')]);
    const { container, update } = renderHook('alice', 'reblogs');
    await act(async () => { await container.result.loadMore(); });
    expect(container.result.posts.map((p) => p.permlink)).toEqual(['reblogged']);

    update('alice', 'posts');
    expect(container.result.posts).toEqual([]);
    await act(async () => { await container.result.loadMore(); });
    expect(mockCall).toHaveBeenLastCalledWith('bridge', 'get_account_posts', expect.objectContaining({ sort: 'posts', start_permlink: '' }));
    expect(container.result.posts.map((p) => p.permlink)).toEqual(['own']);
});
