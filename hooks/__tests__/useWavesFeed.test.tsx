/**
 * Tests for useWavesFeed — maps wavesFeedService's raw WaveItems into the
 * SnapData shape Snap.tsx renders, with isWave:true tagging.
 */

jest.mock('../../services/wavesFeedService', () => ({
  fetchWaveItems: jest.fn(),
}));

jest.mock('../../services/AvatarService', () => ({
  avatarService: {
    getAvatarUrl: jest.fn(),
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useWavesFeed, UseWavesFeedResult } from '../useWavesFeed';
import { fetchWaveItems } from '../../services/wavesFeedService';
import { avatarService } from '../../services/AvatarService';

const mockFetchWaveItems = fetchWaveItems as jest.Mock;
const mockGetAvatarUrl = avatarService.getAvatarUrl as jest.Mock;

// `container` is mutated in place on every re-render, so callers must read
// `container.result` fresh after each `act()` rather than destructuring it
// once — the hook returns a new object per render.
function renderUseWavesFeed(username: string | null = null): { result: UseWavesFeedResult } {
  const container: { result: UseWavesFeedResult } = { result: null as unknown as UseWavesFeedResult };
  const TestComponent = () => { container.result = useWavesFeed(username); return null; };
  act(() => { create(React.createElement(TestComponent)); });
  return container;
}

function waveItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    author: 'ecency-user',
    permlink: 'wave-1',
    created: '2026-01-01T12:00:00.000Z',
    parentAuthor: 'ecency.waves',
    parentPermlink: 'waves-container',
    body: 'a wave',
    children: 2,
    active_votes: [],
    ...overrides,
  };
}

describe('useWavesFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvatarUrl.mockResolvedValue({ url: 'https://images.hive.blog/u/ecency-user/avatar', fromCache: false, source: 'fallback' });
  });

  it('populates waves with isWave:true and mapped SnapData fields on initial fetch', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({
      waves: [waveItem()],
      nextCursor: '2026-01-01T12:00:00.000Z',
      hasMore: true,
    });

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });

    expect(hook.result.waves).toHaveLength(1);
    const mapped = hook.result.waves[0];
    expect(mapped.isWave).toBe(true);
    expect(mapped.author).toBe('ecency-user');
    expect(mapped.permlink).toBe('wave-1');
    expect(mapped.replyCount).toBe(2);
    expect(mapped.payout).toBe(0);
    expect(mapped.avatarUrl).toBe('https://images.hive.blog/u/ecency-user/avatar');
    expect(hook.result.loading).toBe(false);
    expect(hook.result.error).toBeNull();
  });

  it('normalizes a created timestamp missing the trailing Z to UTC', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({
      waves: [waveItem({ created: '2026-01-01T12:00:00.000' })],
      nextCursor: null,
      hasMore: false,
    });

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });

    expect(hook.result.waves[0].created).toBe('2026-01-01T12:00:00.000Z');
  });

  it('computes hasUpvoted true only when the current username voted with positive percent', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({
      waves: [waveItem({
        active_votes: [{ voter: 'alice', percent: 10000 }, { voter: 'bob', percent: -5000 }],
      })],
      nextCursor: null,
      hasMore: false,
    });

    const hook = renderUseWavesFeed('alice');
    await act(async () => { await hook.result.fetchWaves(); });

    expect(hook.result.waves[0].hasUpvoted).toBe(true);
  });

  it('loadMore appends to the existing waves and advances the cursor', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({
      waves: [waveItem({ permlink: 'wave-1', created: '2026-01-01T12:00:00.000Z' })],
      nextCursor: '2026-01-01T12:00:00.000Z',
      hasMore: true,
    });

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });
    expect(hook.result.waves).toHaveLength(1);

    mockFetchWaveItems.mockResolvedValueOnce({
      waves: [waveItem({ permlink: 'wave-2', created: '2026-01-01T11:00:00.000Z' })],
      nextCursor: '2026-01-01T11:00:00.000Z',
      hasMore: false,
    });

    await act(async () => { await hook.result.loadMore(); });

    expect(hook.result.waves.map(w => w.permlink)).toEqual(['wave-1', 'wave-2']);
    expect(mockFetchWaveItems).toHaveBeenLastCalledWith('2026-01-01T12:00:00.000Z');
    expect(hook.result.hasMore).toBe(false);
  });

  it('loadMore is a no-op once hasMore is false', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({ waves: [waveItem()], nextCursor: null, hasMore: false });

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });

    mockFetchWaveItems.mockClear();
    await act(async () => { await hook.result.loadMore(); });

    expect(mockFetchWaveItems).not.toHaveBeenCalled();
  });

  it('leaves waves empty and sets an error without throwing when the service call rejects', async () => {
    mockFetchWaveItems.mockRejectedValueOnce(new Error('unexpected failure'));

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });

    expect(hook.result.waves).toEqual([]);
    expect(hook.result.error).toBe('unexpected failure');
    expect(hook.result.loading).toBe(false);
  });

  it('falls back to no avatarUrl if avatarService throws for an author', async () => {
    mockFetchWaveItems.mockResolvedValueOnce({ waves: [waveItem()], nextCursor: null, hasMore: false });
    mockGetAvatarUrl.mockRejectedValueOnce(new Error('avatar service down'));

    const hook = renderUseWavesFeed();
    await act(async () => { await hook.result.fetchWaves(); });

    expect(hook.result.waves).toHaveLength(1);
    expect(hook.result.waves[0].avatarUrl).toBeUndefined();
  });
});
