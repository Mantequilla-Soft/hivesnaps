/**
 * Tests for pointsService — public reads (summary/leaderboard) plus the
 * fire-and-forget award call.
 */

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

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();

    jest.doMock('../pointsAuthService', () => ({
      getPointsAuthToken: jest.fn(),
    }));
    jest.doMock('../../utils/pointsEvents', () => ({
      emitPointsEarned: jest.fn(),
    }));

    pointsService = require('../pointsService');
    getPointsAuthToken = require('../pointsAuthService').getPointsAuthToken;
    emitPointsEarned = require('../../utils/pointsEvents').emitPointsEarned;
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
});
