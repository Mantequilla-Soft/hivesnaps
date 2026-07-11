/**
 * Tests for discoveryService — fetches trending/resurrected snaps from
 * snapie.io's discovery engine, single page, no pagination.
 */

type FetchTrendingSnaps = typeof import('../discoveryService').fetchTrendingSnaps;

function trendingItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    author: 'some-snapper',
    permlink: `snap-${Math.random()}`,
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

function mockFetchOnce(items: unknown[], hasMore = false) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ items, hasMore }),
  });
}

describe('discoveryService', () => {
  let fetchTrendingSnaps: FetchTrendingSnaps;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    ({ fetchTrendingSnaps } = require('../discoveryService'));
  });

  it('returns the items from a successful fetch', async () => {
    mockFetchOnce([trendingItem({ permlink: 't1' }), trendingItem({ permlink: 't2', discoveryReason: 'resurrected' })]);

    const result = await fetchTrendingSnaps();

    expect(result).toHaveLength(2);
    expect(result[0].isDiscovery).toBe(true);
    expect(result[1].discoveryReason).toBe('resurrected');
  });

  it('makes a single request — no follow-up pagination', async () => {
    mockFetchOnce([trendingItem()]);
    await fetchTrendingSnaps();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('omits the username param when not provided', async () => {
    mockFetchOnce([]);
    await fetchTrendingSnaps();

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('username=');
    expect(calledUrl).toContain('https://snapie.io/api/discovery/snap-candidates');
  });

  it('includes the username param when provided, for server-side mute filtering', async () => {
    mockFetchOnce([]);
    await fetchTrendingSnaps('alice');

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('username=alice');
  });

  it('returns an empty array and does not throw on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    const result = await fetchTrendingSnaps();

    expect(result).toEqual([]);
  });

  it('returns an empty array on a non-OK HTTP response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({}),
    });

    const result = await fetchTrendingSnaps();

    expect(result).toEqual([]);
  });

  it('enters a cooldown after a failure and suppresses the next call without hitting fetch', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    await fetchTrendingSnaps();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const result = await fetchTrendingSnaps();

    expect(global.fetch).toHaveBeenCalledTimes(1); // no second attempt while on cooldown
    expect(result).toEqual([]);
  });
});
