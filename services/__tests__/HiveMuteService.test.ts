/**
 * Tests for HiveMuteService — unions community-muted
 * (bridge.list_community_roles) and personally-muted (bridge.get_follow_list)
 * accounts directly from Hive's own bridge API, with a 24h cache that falls
 * back to stale data instead of an empty set when a refetch fails.
 */

jest.mock('../HiveClient', () => ({
  getClient: jest.fn(),
}));

import { fetchMutedList, clearMutedListCache } from '../HiveMuteService';
import { getClient } from '../HiveClient';

const mockCall = jest.fn();
(getClient as jest.Mock).mockReturnValue({ call: mockCall });

describe('fetchMutedList', () => {
  beforeEach(() => {
    mockCall.mockReset();
    clearMutedListCache('alice');
  });

  it('returns an empty set for an empty username without calling the client', async () => {
    const result = await fetchMutedList('');
    expect(result.size).toBe(0);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('unions community-muted and personally-muted accounts, lowercased and deduped', async () => {
    mockCall.mockImplementation(async (_api: string, method: string) => {
      if (method === 'list_community_roles') {
        return [
          ['Bob', 'muted'],
          ['carol', 'mod'],
        ];
      }
      if (method === 'get_follow_list') {
        return [{ name: 'BOB' }, { name: 'dave' }];
      }
      return [];
    });

    const result = await fetchMutedList('alice');
    expect(Array.from(result).sort()).toEqual(['bob', 'dave']);
  });

  it('serves cached data on a subsequent call within the TTL without refetching', async () => {
    mockCall.mockResolvedValue([]);
    await fetchMutedList('alice');
    expect(mockCall).toHaveBeenCalledTimes(2); // community + personal

    await fetchMutedList('alice');
    expect(mockCall).toHaveBeenCalledTimes(2); // still 2 — served from cache
  });

  it('falls back to stale cached data instead of an empty set when a refetch fails', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);

    mockCall.mockImplementation(async (_api: string, method: string) => {
      if (method === 'list_community_roles') return [['bob', 'muted']];
      return [];
    });
    const first = await fetchMutedList('alice');
    expect(Array.from(first)).toEqual(['bob']);

    // Advance past the 24h cache TTL and make the refetch fail.
    nowSpy.mockReturnValue(1_000_000 + 25 * 60 * 60 * 1000);
    mockCall.mockRejectedValue(new Error('network down'));

    const second = await fetchMutedList('alice');
    expect(Array.from(second)).toEqual(['bob']);

    nowSpy.mockRestore();
  });

  it('never throws, even when every bridge call rejects and nothing is cached', async () => {
    mockCall.mockRejectedValue(new Error('offline'));
    const result = await fetchMutedList('brand-new-user');
    expect(result.size).toBe(0);
  });
});

describe('clearMutedListCache', () => {
  beforeEach(() => {
    mockCall.mockReset();
    clearMutedListCache('alice');
  });

  it('forces the next fetchMutedList call to hit the network again', async () => {
    mockCall.mockResolvedValue([]);
    await fetchMutedList('alice');
    expect(mockCall).toHaveBeenCalledTimes(2);

    await fetchMutedList('alice');
    expect(mockCall).toHaveBeenCalledTimes(2); // cached

    clearMutedListCache('alice');
    await fetchMutedList('alice');
    expect(mockCall).toHaveBeenCalledTimes(4); // refetched
  });
});
