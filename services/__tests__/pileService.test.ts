/**
 * Tests for pileService — public reads (pile/catalog/inventory) plus the
 * direct user-initiated writes (buy/throw/claim), which throw on any
 * infra failure instead of swallowing (unlike pointsService's awardPoints).
 */

type PileServiceModule = typeof import('../pileService');

function mockFetchOnce(body: unknown, ok = true, status = 200, statusText = 'OK') {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

const ITEM: import('../pileService').ItemDTO = {
  id: 'item-1',
  creatorUsername: 'alice',
  name: 'Tomato',
  description: 'Squishy',
  imageUrl: 'https://example.com/tomato.png',
  price: 25,
  purchaseCount: 3,
};

describe('pileService', () => {
  let pileService: PileServiceModule;
  let getPointsAuthToken: jest.Mock;
  let emitPointsSpent: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();

    jest.doMock('../pointsAuthService', () => ({
      getPointsAuthToken: jest.fn(),
    }));
    jest.doMock('../../utils/pointsEvents', () => ({
      emitPointsSpent: jest.fn(),
    }));

    pileService = require('../pileService');
    getPointsAuthToken = require('../pointsAuthService').getPointsAuthToken;
    emitPointsSpent = require('../../utils/pointsEvents').emitPointsSpent;
  });

  describe('getPile', () => {
    it('returns the pile from a successful fetch', async () => {
      const pile = [{ item: ITEM, count: 2, recentThrowers: [] }];
      mockFetchOnce({ pile });

      const result = await pileService.getPile('bob', 'my-permlink');

      expect(result).toEqual(pile);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toBe('https://snapie.io/api/points/market/pile/bob/my-permlink');
    });

    it('returns an empty array and does not throw on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await pileService.getPile('bob', 'my-permlink');

      expect(result).toEqual([]);
    });

    it('enters a cooldown after a failure and suppresses the next call without hitting fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
      await pileService.getPile('bob', 'my-permlink');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await pileService.getPile('bob', 'my-permlink');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('listMarketItems', () => {
    it('returns the catalog page from a successful fetch', async () => {
      const page = { items: [ITEM], hasMore: false };
      mockFetchOnce(page);

      const result = await pileService.listMarketItems('hot', 0);

      expect(result).toEqual(page);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('sort=hot');
      expect(calledUrl).toContain('offset=0');
    });

    it('returns an empty page and does not throw on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await pileService.listMarketItems();

      expect(result).toEqual({ items: [], hasMore: false });
    });
  });

  describe('getMyInventory', () => {
    it('returns an empty array without calling fetch when there is no auth token', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      const result = await pileService.getMyInventory();

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns the inventory on a successful authenticated fetch', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ inventory: [{ item: ITEM, unitIds: ['unit-1'] }] });

      const result = await pileService.getMyInventory();

      expect(result).toEqual([{ item: ITEM, unitIds: ['unit-1'] }]);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://snapie.io/api/points/market/inventory');
      expect(init.headers.Authorization).toBe('Bearer jwt-token');
    });

    it('returns an empty array on a non-OK response', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({}, false, 500, 'Server Error');

      const result = await pileService.getMyInventory();

      expect(result).toEqual([]);
    });
  });

  describe('buyItem', () => {
    it('throws when there is no auth token', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      await expect(pileService.buyItem('item-1', 25)).rejects.toThrow('start a session');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws on a non-OK response', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({}, false, 500, 'Server Error');

      await expect(pileService.buyItem('item-1', 25)).rejects.toThrow('Could not complete this purchase');
    });

    it('emits pointsSpent and returns the result on a successful purchase', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'purchased', unitId: 'unit-1', balance: 75 });

      const result = await pileService.buyItem('item-1', 25);

      expect(result).toEqual({ status: 'purchased', unitId: 'unit-1', balance: 75 });
      expect(emitPointsSpent).toHaveBeenCalledWith({ spent: 25, balance: 75 });
      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(init.body).purchaseRefKey).toEqual(expect.any(String));
    });

    it('does not emit pointsSpent when the purchase is declined (e.g. insufficient balance)', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'insufficient_balance', unitId: null, balance: 5 });

      const result = await pileService.buyItem('item-1', 25);

      expect(result.status).toBe('insufficient_balance');
      expect(emitPointsSpent).not.toHaveBeenCalled();
    });

    it('throws NotEnrolledError on a 403 not_enrolled response', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ error: 'not_enrolled' }, false, 403, 'Forbidden');

      await expect(pileService.buyItem('item-1', 25)).rejects.toThrow(pileService.NotEnrolledError);
    });

    it('throws a generic error (not NotEnrolledError) on a 403 with a different body', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ error: 'something_else' }, false, 403, 'Forbidden');

      await expect(pileService.buyItem('item-1', 25)).rejects.toMatchObject({
        message: expect.stringContaining('Could not complete this purchase'),
      });
    });
  });

  describe('throwItem', () => {
    const target = { author: 'bob', permlink: 'my-permlink', type: 'snap' as const };

    it('throws when there is no auth token', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      await expect(pileService.throwItem('unit-1', target, ITEM)).rejects.toThrow('start a session');
    });

    it('posts the throw and returns the result without emitting when not anonymous', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'thrown', balance: 100 });

      const result = await pileService.throwItem('unit-1', target, ITEM, false);

      expect(result).toEqual({ status: 'thrown', balance: 100 });
      expect(emitPointsSpent).not.toHaveBeenCalled();
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://snapie.io/api/points/market/throw');
      expect(JSON.parse(init.body)).toEqual({
        unitId: 'unit-1',
        targetAuthor: 'bob',
        targetPermlink: 'my-permlink',
        targetType: 'snap',
        anonymous: false,
      });
    });

    it('emits pointsSpent for the burn when an anonymous throw succeeds', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'thrown', balance: 75 });

      await pileService.throwItem('unit-1', target, ITEM, true);

      expect(emitPointsSpent).toHaveBeenCalledWith({ spent: ITEM.price, balance: 75 });
    });

    it('does not emit pointsSpent when an anonymous throw is declined for insufficient balance', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'insufficient_balance', balance: 5 });

      const result = await pileService.throwItem('unit-1', target, ITEM, true);

      expect(result.status).toBe('insufficient_balance');
      expect(emitPointsSpent).not.toHaveBeenCalled();
    });
  });

  describe('claimOwnItem', () => {
    it('throws when there is no auth token', async () => {
      getPointsAuthToken.mockResolvedValueOnce(null);

      await expect(pileService.claimOwnItem('item-1')).rejects.toThrow('start a session');
    });

    it('returns the result without emitting pointsSpent (free claim)', async () => {
      getPointsAuthToken.mockResolvedValueOnce('jwt-token');
      mockFetchOnce({ status: 'claimed', unitId: 'unit-9' });

      const result = await pileService.claimOwnItem('item-1');

      expect(result).toEqual({ status: 'claimed', unitId: 'unit-9' });
      expect(emitPointsSpent).not.toHaveBeenCalled();
    });
  });
});
