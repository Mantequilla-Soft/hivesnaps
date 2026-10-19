/**
 * Tests for pointsService — public reads (summary/leaderboard), the
 * fire-and-forget award call, and buying points (verify + pending-purchase
 * persistence).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

type PointsServiceModule = typeof import('../pointsService');

function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function mockFetchOnce(body: unknown, ok = true, status = 200, statusText = 'OK') {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

describe('pointsService', () => {
  let pointsService: PointsServiceModule;
  let getPointsAuthToken: jest.Mock;
  let emitPointsEarned: jest.Mock;
  let emitPointsPurchased: jest.Mock;
  let AsyncStorage: { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();

    jest.doMock('../pointsAuthService', () => ({
      getPointsAuthToken: jest.fn(),
    }));
    jest.doMock('../../utils/pointsEvents', () => ({
      emitPointsEarned: jest.fn(),
      emitPointsPurchased: jest.fn(),
    }));

    pointsService = require('../pointsService');
    getPointsAuthToken = require('../pointsAuthService').getPointsAuthToken;
    emitPointsEarned = require('../../utils/pointsEvents').emitPointsEarned;
    emitPointsPurchased = require('../../utils/pointsEvents').emitPointsPurchased;
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('fetchPointsSummary', () => {
    it('returns the summary from a successful fetch', async () => {
      mockFetchOnce({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });

      const result = await pointsService.fetchPointsSummary('alice');

      expect(result).toEqual({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://snapie.io/api/points/summary?username=alice');
    });

    it('returns null and does not throw on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await pointsService.fetchPointsSummary('alice');

      expect(result).toBeNull();
    });

    it('returns null on a non-OK HTTP response', async () => {
      mockFetchOnce({}, false, 503, 'Service Unavailable');

      const result = await pointsService.fetchPointsSummary('alice');

      expect(result).toBeNull();
    });

    it('enters a cooldown after a failure and suppresses the next call without hitting fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
      await pointsService.fetchPointsSummary('alice');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const result = await pointsService.fetchPointsSummary('alice');

      expect(global.fetch).toHaveBeenCalledTimes(1); // no second attempt while on cooldown
      expect(result).toBeNull();
    });
  });

  describe('fetchLeaderboard', () => {
    it('returns the leaderboard page from a successful fetch', async () => {
      const page = { entries: [{ rank: 1, username: 'alice', lifetimeEarned: 100, balance: 90 }], hasMore: true };
      mockFetchOnce(page);

      const result = await pointsService.fetchLeaderboard(50, 0);

      expect(result).toEqual(page);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=50');
      expect(calledUrl).toContain('offset=0');
    });

    it('returns an empty page and does not throw on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await pointsService.fetchLeaderboard();

      expect(result).toEqual({ entries: [], hasMore: false });
    });
  });

  describe('awardPoints', () => {
    it('does nothing (no fetch) when no auth token is available', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      pointsService.awardPoints('vote', 'alice', 'bob', 'post-1');
      await flushMicrotasks();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(emitPointsEarned).not.toHaveBeenCalled();
    });

    it('posts the award and emits pointsEarned on a real award', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'awarded', awarded: 1, balance: 11 });

      pointsService.awardPoints('vote', 'alice', 'bob', 'post-1');
      await flushMicrotasks();

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://snapie.io/api/points/award');
      expect(init.headers.Authorization).toBe('Bearer jwt-token');
      expect(JSON.parse(init.body)).toEqual({ actionType: 'vote', author: 'bob', permlink: 'post-1' });
      expect(emitPointsEarned).toHaveBeenCalledWith({ awarded: 1, balance: 11 });
    });

    it('does not emit when the server rejects the award (capped/ineligible/muted)', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({}, false, 403, 'Forbidden');

      pointsService.awardPoints('vote', 'alice', 'bob', 'post-1');
      await flushMicrotasks();

      expect(emitPointsEarned).not.toHaveBeenCalled();
    });

    it('swallows a network error without throwing', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      expect(() => pointsService.awardPoints('vote', 'alice', 'bob', 'post-1')).not.toThrow();
      await flushMicrotasks();

      expect(emitPointsEarned).not.toHaveBeenCalled();
    });
  });

  describe('verifyPointsPurchase', () => {
    it('posts the txid, emits pointsPurchased, and clears the pending record on a credit', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'credited', pointsCredited: 100, balance: 110 });

      const result = await pointsService.verifyPointsPurchase('alice', 'txid-1');

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://snapie.io/api/points/purchase/verify');
      expect(init.headers.Authorization).toBe('Bearer jwt-token');
      expect(JSON.parse(init.body)).toEqual({ txid: 'txid-1' });
      expect(result).toEqual({ status: 'credited', pointsCredited: 100, balance: 110 });
      expect(emitPointsPurchased).toHaveBeenCalledWith({ pointsCredited: 100, balance: 110 });
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('clears the pending record without emitting on a duplicate or out_of_range result', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'duplicate', pointsCredited: 0, balance: 10 });

      await pointsService.verifyPointsPurchase('alice', 'txid-1');

      expect(emitPointsPurchased).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('leaves the pending record in place on an unverified result', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'unverified', pointsCredited: 0, balance: 10 });

      await pointsService.verifyPointsPurchase('alice', 'txid-1');

      expect(emitPointsPurchased).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('throws and leaves the record in place on an unrecognized status — an allowlist, not "anything but unverified"', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'weird', pointsCredited: 0, balance: 10 });

      await expect(pointsService.verifyPointsPurchase('alice', 'txid-1')).rejects.toThrow();

      expect(emitPointsPurchased).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('throws and leaves the record in place on a response with no status at all', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ error: 'something unexpected' });

      await expect(pointsService.verifyPointsPurchase('alice', 'txid-1')).rejects.toThrow();

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('throws when there is no auth token — a purchase failure must surface, unlike awardPoints', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      await expect(pointsService.verifyPointsPurchase('alice', 'txid-1')).rejects.toThrow();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws on a non-OK HTTP response', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({}, false, 500, 'Server Error');

      await expect(pointsService.verifyPointsPurchase('alice', 'txid-1')).rejects.toThrow();
    });
  });

  describe('pending purchase persistence', () => {
    it('propagates a write failure from recordPendingPurchase — its caller must know the record did not actually persist', async () => {
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));

      await expect(pointsService.recordPendingPurchase('alice', 'txid-1')).rejects.toThrow('disk full');
    });

    it('swallows a write failure from clearPendingPurchase — non-critical, a re-verified txid just comes back duplicate', async () => {
      // Two entries so the filtered list is non-empty and clearing goes
      // through setItem (not removeItem), which is what's made to fail here.
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify([
        { txid: 'txid-1', username: 'alice', createdAt: Date.now() },
        { txid: 'txid-2', username: 'alice', createdAt: Date.now() },
      ]));
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));

      await expect(pointsService.clearPendingPurchase('txid-1')).resolves.not.toThrow();
    });

    it('propagates a read failure from recordPendingPurchase instead of writing a guessed-empty list over real records', async () => {
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(pointsService.recordPendingPurchase('alice', 'txid-1')).rejects.toThrow('storage unavailable');
      // The dangerous outcome this guards against: writing [{txid-1}] (or
      // worse, []) over whatever was actually stored, because the read that
      // should have informed the write failed silently instead of throwing.
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('does not write anything from clearPendingPurchase when it cannot read the current list', async () => {
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(pointsService.clearPendingPurchase('txid-1')).resolves.not.toThrow();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('serializes concurrent record calls so neither clobbers the other\'s write', async () => {
      // A stateful AsyncStorage double (unlike this file's usual
      // mockResolvedValue chaining) — needed to actually observe whether two
      // concurrent read-modify-write calls interleave. The artificial delay
      // on the read gives an unserialized implementation room to race.
      let store: string | null = null;
      AsyncStorage.getItem.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return store;
      });
      AsyncStorage.setItem.mockImplementation(async (_key: string, value: string) => {
        store = value;
      });

      await Promise.all([
        pointsService.recordPendingPurchase('alice', 'txid-1'),
        pointsService.recordPendingPurchase('alice', 'txid-2'),
      ]);

      const saved = JSON.parse(store!) as { txid: string }[];
      expect(saved.map(p => p.txid)).toEqual(expect.arrayContaining(['txid-1', 'txid-2']));
      expect(saved).toHaveLength(2);
    });

    it('records, reads back, and clears a pending purchase', async () => {
      await pointsService.recordPendingPurchase('alice', 'txid-1');
      const [, storedJson] = AsyncStorage.setItem.mock.calls[0];
      AsyncStorage.getItem.mockResolvedValue(storedJson);

      expect(await pointsService.getPendingPurchaseTxids('alice')).toEqual(['txid-1']);

      await pointsService.clearPendingPurchase('txid-1');
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('does not drop an earlier unresolved txid when a second purchase is recorded', async () => {
      // The bug this guards: a single-slot "pending purchase" meant recording
      // a second real transfer silently buried the first one's txid — with
      // real HBD already sent and no way back to it except a support request.
      await pointsService.recordPendingPurchase('alice', 'txid-1');
      AsyncStorage.getItem.mockResolvedValue(AsyncStorage.setItem.mock.calls[0][1]);

      await pointsService.recordPendingPurchase('alice', 'txid-2');
      AsyncStorage.getItem.mockResolvedValue(AsyncStorage.setItem.mock.calls[1][1]);

      const txids = await pointsService.getPendingPurchaseTxids('alice');
      expect(txids).toEqual(expect.arrayContaining(['txid-1', 'txid-2']));
      expect(txids).toHaveLength(2);
    });

    it('replaces rather than duplicates a re-recorded txid', async () => {
      await pointsService.recordPendingPurchase('alice', 'txid-1');
      AsyncStorage.getItem.mockResolvedValue(AsyncStorage.setItem.mock.calls[0][1]);

      await pointsService.recordPendingPurchase('alice', 'txid-1');
      AsyncStorage.getItem.mockResolvedValue(AsyncStorage.setItem.mock.calls[1][1]);

      expect(await pointsService.getPendingPurchaseTxids('alice')).toEqual(['txid-1']);
    });

    it('ignores another username\'s pending purchase but keeps it in storage', async () => {
      await pointsService.recordPendingPurchase('alice', 'txid-1');
      AsyncStorage.getItem.mockResolvedValue(AsyncStorage.setItem.mock.calls[0][1]);

      expect(await pointsService.getPendingPurchaseTxids('bob')).toEqual([]);
      expect(await pointsService.getPendingPurchaseTxids('alice')).toEqual(['txid-1']);
    });

    it('drops only a stale entry, keeping a fresh one for the same user', async () => {
      const list = [
        { txid: 'stale', username: 'alice', createdAt: Date.now() - 25 * 60 * 60 * 1000 },
        { txid: 'fresh', username: 'alice', createdAt: Date.now() },
      ];
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(list));

      expect(await pointsService.getPendingPurchaseTxids('alice')).toEqual(['fresh']);
      expect(AsyncStorage.setItem).toHaveBeenCalled(); // persists the pruned list
    });

    it('returns an empty list when there is nothing pending', async () => {
      expect(await pointsService.getPendingPurchaseTxids('alice')).toEqual([]);
    });
  });

  describe('resumePendingPurchases', () => {
    it('returns an empty list when there is no pending purchase', async () => {
      const result = await pointsService.resumePendingPurchases('alice');

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('re-verifies a pending purchase and returns the result', async () => {
      const stored = JSON.stringify([{ txid: 'txid-1', username: 'alice', createdAt: Date.now() }]);
      AsyncStorage.getItem.mockResolvedValue(stored);
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'credited', pointsCredited: 100, balance: 110 });

      const result = await pointsService.resumePendingPurchases('alice');

      expect(result).toEqual([{ status: 'credited', pointsCredited: 100, balance: 110 }]);
    });

    it('resumes every pending txid, not just one', async () => {
      const stored = JSON.stringify([
        { txid: 'txid-1', username: 'alice', createdAt: Date.now() },
        { txid: 'txid-2', username: 'alice', createdAt: Date.now() },
      ]);
      AsyncStorage.getItem.mockResolvedValue(stored);
      getPointsAuthToken.mockResolvedValue('jwt-token');
      mockFetchOnce({ status: 'credited', pointsCredited: 100, balance: 110 });
      mockFetchOnce({ status: 'duplicate', pointsCredited: 0, balance: 110 });

      const result = await pointsService.resumePendingPurchases('alice');

      expect(result).toEqual([
        { status: 'credited', pointsCredited: 100, balance: 110 },
        { status: 'duplicate', pointsCredited: 0, balance: 110 },
      ]);
    });

    it('leaves a still-unverified txid pending and omits a throwing one from the result, clearing neither', async () => {
      const stored = JSON.stringify([
        { txid: 'still-unverified', username: 'alice', createdAt: Date.now() },
        { txid: 'auth-failed', username: 'alice', createdAt: Date.now() },
      ]);
      AsyncStorage.getItem.mockResolvedValue(stored);
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'unverified', pointsCredited: 0, balance: 10 });
      getPointsAuthToken.mockResolvedValueOnce(null); // second txid's verify throws

      const result = await pointsService.resumePendingPurchases('alice');

      expect(result).toEqual([{ status: 'unverified', pointsCredited: 0, balance: 10 }]);
      // Neither outcome is 'credited'/'duplicate'/'out_of_range', so
      // clearPendingPurchase must never run for either txid — both entries
      // are still fresh, so nothing gets pruned either.
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
