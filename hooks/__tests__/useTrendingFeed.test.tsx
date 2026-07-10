/**
 * Tests for useTrendingFeed — maps discoveryService's raw TrendingSnap items
 * (already close to the native Snap shape) with resolved avatars and
 * UTC-normalized timestamps. No pagination — fetched once per session.
 */

jest.mock('../../services/discoveryService', () => ({
  fetchTrendingSnaps: jest.fn(),
}));

jest.mock('../../services/AvatarService', () => ({
  avatarService: {
    getAvatarUrl: jest.fn(),
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useTrendingFeed, UseTrendingFeedResult } from '../useTrendingFeed';
import { fetchTrendingSnaps } from '../../services/discoveryService';
import { avatarService } from '../../services/AvatarService';

const mockFetchTrendingSnaps = fetchTrendingSnaps as jest.Mock;
const mockGetAvatarUrl = avatarService.getAvatarUrl as jest.Mock;

// `container` is mutated in place on every re-render, so callers must read
// `container.result` fresh after each `act()` rather than destructuring it
// once — the hook returns a new object per render.
function renderUseTrendingFeed(username: string | null = null): { result: UseTrendingFeedResult } {
  const container: { result: UseTrendingFeedResult } = { result: null as unknown as UseTrendingFeedResult };
  const TestComponent = () => { container.result = useTrendingFeed(username); return null; };
  act(() => { create(React.createElement(TestComponent)); });
  return container;
}

function trendingItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    author: 'hot-author',
    permlink: 'snap-1',
    created: '2026-01-01T12:00:00',
    category: 'hive-124838',
    net_votes: 3,
    children: 2,
    pending_payout_value: '0.010 HBD',
    active_votes: [],
    isDiscovery: true,
    discoveryReason: 'trending',
    ...overrides,
  };
}

describe('useTrendingFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvatarUrl.mockResolvedValue({ url: 'https://images.hive.blog/u/hot-author/avatar', fromCache: false, source: 'fallback' });
  });

  it('populates trending with resolved avatars and passes isDiscovery/discoveryReason through untouched', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([trendingItem()]);

    const hook = renderUseTrendingFeed();
    await act(async () => { await hook.result.fetchTrending(); });

    expect(hook.result.trending).toHaveLength(1);
    const item = hook.result.trending[0];
    expect(item.isDiscovery).toBe(true);
    expect(item.discoveryReason).toBe('trending');
    expect(item.avatarUrl).toBe('https://images.hive.blog/u/hot-author/avatar');
    expect(hook.result.loading).toBe(false);
    expect(hook.result.error).toBeNull();
  });

  it('preserves resurrected discoveryReason', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([trendingItem({ discoveryReason: 'resurrected' })]);

    const hook = renderUseTrendingFeed();
    await act(async () => { await hook.result.fetchTrending(); });

    expect(hook.result.trending[0].discoveryReason).toBe('resurrected');
  });

  it('normalizes a created timestamp missing the trailing Z to UTC', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([trendingItem({ created: '2026-01-01T12:00:00' })]);

    const hook = renderUseTrendingFeed();
    await act(async () => { await hook.result.fetchTrending(); });

    expect(hook.result.trending[0].created).toBe('2026-01-01T12:00:00Z');
  });

  it('passes the username through to the service call', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([]);

    const hook = renderUseTrendingFeed('alice');
    await act(async () => { await hook.result.fetchTrending(); });

    expect(mockFetchTrendingSnaps).toHaveBeenCalledWith('alice');
  });

  it('passes undefined username through when not logged in', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([]);

    const hook = renderUseTrendingFeed(null);
    await act(async () => { await hook.result.fetchTrending(); });

    expect(mockFetchTrendingSnaps).toHaveBeenCalledWith(undefined);
  });

  it('falls back to no avatarUrl if avatarService throws for an author', async () => {
    mockFetchTrendingSnaps.mockResolvedValueOnce([trendingItem()]);
    mockGetAvatarUrl.mockRejectedValueOnce(new Error('avatar service down'));

    const hook = renderUseTrendingFeed();
    await act(async () => { await hook.result.fetchTrending(); });

    expect(hook.result.trending).toHaveLength(1);
    expect(hook.result.trending[0].avatarUrl).toBeUndefined();
  });

  it('leaves trending empty and sets an error without throwing when the service call rejects unexpectedly', async () => {
    mockFetchTrendingSnaps.mockRejectedValueOnce(new Error('unexpected failure'));

    const hook = renderUseTrendingFeed();
    await act(async () => { await hook.result.fetchTrending(); });

    expect(hook.result.trending).toEqual([]);
    expect(hook.result.error).toBe('unexpected failure');
    expect(hook.result.loading).toBe(false);
  });
});
