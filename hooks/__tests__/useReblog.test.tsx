/**
 * Tests for useReblog: seeds "already reblogged" from the chain, guards
 * own posts / non-root posts, updates optimistically, rolls back on failure
 * and awards points on success.
 */

jest.mock('../../services/HiveFollowService', () => ({
    broadcastReblog: jest.fn(),
    fetchRebloggedBy: jest.fn(),
}));
jest.mock('../../services/pointsService', () => ({ awardPoints: jest.fn() }));
jest.mock('../../utils/pointsConfig', () => ({ isPointsEnabled: jest.fn() }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useReblog, type UseReblogResult } from '../useReblog';
import { broadcastReblog, fetchRebloggedBy } from '../../services/HiveFollowService';
import { awardPoints } from '../../services/pointsService';
import { isPointsEnabled } from '../../utils/pointsConfig';

const mockBroadcast = broadcastReblog as jest.Mock;
const mockFetch = fetchRebloggedBy as jest.Mock;
const mockAward = awardPoints as jest.Mock;
const mockPointsEnabled = isPointsEnabled as jest.Mock;

interface Props { author: string; permlink: string; currentUser: string | null; isRootPost: boolean }

function renderHook(props: Props): { container: { result: UseReblogResult }; update: (p: Props) => void } {
    const container = { result: null as unknown as UseReblogResult };
    const Test = (p: Props): null => {
        container.result = useReblog(p);
        return null;
    };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Test, props)); });
    return { container, update: (p): void => { act(() => { renderer.update(React.createElement(Test, p)); }); } };
}

const flush = (): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const base: Props = { author: 'alice', permlink: 'post-1', currentUser: 'me', isRootPost: true };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockResolvedValue([]);
    mockBroadcast.mockResolvedValue(undefined);
    mockPointsEnabled.mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

it('seeds the reblogged state from the chain (case-insensitive)', async () => {
    mockFetch.mockResolvedValue(['bob', 'Me']);
    const { container } = renderHook(base);
    await flush();
    expect(mockFetch).toHaveBeenCalledWith('alice', 'post-1');
    expect(container.result.reblogged).toBe(true);
});

it('cannot reblog your own post, a reply/snap, or while logged out', async () => {
    for (const props of [
        { ...base, author: 'me' },
        { ...base, isRootPost: false },
        { ...base, currentUser: null },
    ]) {
        const { container } = renderHook(props);
        await flush();
        expect(container.result.canReblog).toBe(false);
        let ok: boolean | undefined;
        await act(async () => { ok = await container.result.reblog(); });
        expect(ok).toBe(false);
    }
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
});

it('reblogs, marks the post reblogged and awards points', async () => {
    const { container } = renderHook(base);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await container.result.reblog(); });

    expect(ok).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith('me', 'alice', 'post-1');
    expect(mockAward).toHaveBeenCalledWith('reblog', 'me', 'alice', 'post-1');
    expect(container.result.reblogged).toBe(true);
    expect(container.result.pending).toBe(false);
});

it('rolls back and awards nothing when the broadcast fails', async () => {
    mockBroadcast.mockRejectedValue(new Error('rejected'));
    const { container } = renderHook(base);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await container.result.reblog(); });

    expect(ok).toBe(false);
    expect(container.result.reblogged).toBe(false);
    expect(mockAward).not.toHaveBeenCalled();
});

it('does not broadcast again once reblogged', async () => {
    mockFetch.mockResolvedValue(['me']);
    const { container } = renderHook(base);
    await flush();
    await act(async () => { await container.result.reblog(); });
    expect(mockBroadcast).not.toHaveBeenCalled();
});

it('awards no points when points are switched off', async () => {
    mockPointsEnabled.mockReturnValue(false);
    const { container } = renderHook(base);
    await flush();
    let ok: boolean | undefined;
    await act(async () => { ok = await container.result.reblog(); });
    expect(ok).toBe(true);
    expect(mockPointsEnabled).toHaveBeenCalledWith('me');
    expect(mockAward).not.toHaveBeenCalled();
});

it('an earlier reblog callback sees a lookup that finished after it was captured', async () => {
    let resolveLookup!: (v: string[]) => void;
    mockFetch.mockImplementation(() => new Promise((r) => { resolveLookup = r; }));
    const { container } = renderHook(base);
    const staleReblog = container.result.reblog; // e.g. held by an open confirmation
    await act(async () => { resolveLookup(['me']); });
    expect(container.result.reblogged).toBe(true);

    let ok: boolean | undefined;
    await act(async () => { ok = await staleReblog(); });
    expect(ok).toBe(true);
    expect(mockBroadcast).not.toHaveBeenCalled();
});

it('a failed broadcast for the previous post does not clear the new post’s state', async () => {
    let rejectBroadcast!: (e: Error) => void;
    mockBroadcast.mockImplementation(() => new Promise((_, reject) => { rejectBroadcast = reject; }));
    const { container, update } = renderHook(base);
    await flush();
    let pending!: Promise<boolean>;
    act(() => { pending = container.result.reblog(); });
    expect(container.result.pending).toBe(true);

    mockFetch.mockResolvedValue(['me']);
    update({ ...base, permlink: 'post-2' });
    await flush();
    expect(container.result.reblogged).toBe(true);
    expect(container.result.pending).toBe(false);

    let ok: boolean | undefined;
    await act(async () => { rejectBroadcast(new Error('rejected')); ok = await pending; });
    expect(ok).toBe(false);
    expect(container.result.reblogged).toBe(true);
    expect(container.result.pending).toBe(false);
});
