/**
 * Tests for wavesFeedService — the layer that pulls "wave" items out of
 * snapie.io's blended /api/feed sidecar (snap items in the same payload are
 * intentionally discarded, see the module's header comment).
 */

type FetchWaveItems = typeof import('../wavesFeedService').fetchWaveItems;

function snapItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    source: 'snap',
    author: 'some-snapper',
    permlink: `snap-${Math.random()}`,
    created: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

function waveItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    source: 'wave',
    author: 'some-waver',
    permlink: `wave-${Math.random()}`,
    created: '2026-01-01T12:00:00.000Z',
    parentAuthor: 'ecency.waves',
    parentPermlink: 'waves-container',
    body: 'hello from ecency',
    children: 0,
    active_votes: [],
    ...overrides,
  };
}

function mockFetchOnce(items: unknown[], hasMore: boolean) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ items, hasMore }),
  });
}

describe('wavesFeedService', () => {
  let fetchWaveItems: FetchWaveItems;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    ({ fetchWaveItems } = require('../wavesFeedService'));
  });

  it('keeps only source === "wave" items and discards snaps', async () => {
    const waves = [waveItem({ permlink: 'w1' }), waveItem({ permlink: 'w2' }), waveItem({ permlink: 'w3' }), waveItem({ permlink: 'w4' }), waveItem({ permlink: 'w5' })];
    mockFetchOnce([snapItem(), ...waves, snapItem()], false);

    const result = await fetchWaveItems();

    expect(result.waves).toHaveLength(5);
    expect(result.waves.every(w => w.permlink.startsWith('w'))).toBe(true);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not include a "before" param on the first request', async () => {
    mockFetchOnce([waveItem()], false);
    await fetchWaveItems();

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('before=');
    expect(calledUrl).toContain('https://snapie.io/api/feed');
  });

  it('fetches a follow-up page when the wave yield is thin and hasMore is true', async () => {
    // First page: thin (1 wave), but hasMore true
    mockFetchOnce([waveItem({ permlink: 'w1' }), snapItem()], true);
    // Second page: enough waves to clear the threshold, hasMore false
    mockFetchOnce(
      [waveItem({ permlink: 'w2' }), waveItem({ permlink: 'w3' }), waveItem({ permlink: 'w4' }), waveItem({ permlink: 'w5' })],
      false
    );

    const result = await fetchWaveItems();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.waves).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it('stops after a bounded number of follow-up pages even if still thin', async () => {
    // Every page returns 1 wave and claims there's more — would loop forever without a cap.
    mockFetchOnce([waveItem({ permlink: 'w1', created: '2026-01-01T12:00:00.000Z' })], true);
    mockFetchOnce([waveItem({ permlink: 'w2', created: '2026-01-01T11:00:00.000Z' })], true);
    mockFetchOnce([waveItem({ permlink: 'w3', created: '2026-01-01T10:00:00.000Z' })], true);

    const result = await fetchWaveItems();

    // initial + MAX_FOLLOWUP_PAGES(2) = 3 total requests, then it stops even though hasMore is still true
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.waves).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('2026-01-01T10:00:00.000Z');
  });

  it('treats an empty page as exhausted even if the server claims hasMore true', async () => {
    mockFetchOnce([waveItem({ permlink: 'w1' })], true);
    mockFetchOnce([], true); // server bug/edge case: empty items but hasMore still true

    const result = await fetchWaveItems();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.waves).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('returns a safe empty result and does not throw on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    const result = await fetchWaveItems();

    expect(result).toEqual({ waves: [], nextCursor: null, hasMore: false });
  });

  it('returns a safe empty result on a non-OK HTTP response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({}),
    });

    const result = await fetchWaveItems();

    expect(result).toEqual({ waves: [], nextCursor: null, hasMore: false });
  });

  it('enters a cooldown after a failure and suppresses the next call without hitting fetch', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    await fetchWaveItems();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const result = await fetchWaveItems();

    expect(global.fetch).toHaveBeenCalledTimes(1); // no second attempt while on cooldown
    expect(result).toEqual({ waves: [], nextCursor: null, hasMore: false });
  });
});
