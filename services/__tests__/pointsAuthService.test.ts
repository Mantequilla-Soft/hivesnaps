/**
 * Tests for pointsAuthService — silent challenge/sign/verify against
 * snapie.io's chat auth endpoints, with an AsyncStorage-cached JWT.
 * bs58/elliptic/js-sha256 run for real (deterministic, no network) — only
 * AsyncStorage, AccountStorageService, and fetch are mocked.
 */

import bs58 from 'bs58';

const TEST_USERNAME = 'alice';
// Any valid base58 string ≥33 bytes works — signChallenge only slices bytes
// 1..33 as the private key scalar, it doesn't checksum-validate the WIF.
const TEST_POSTING_KEY = bs58.encode(Buffer.alloc(37, 1));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../AccountStorageService', () => ({
  accountStorageService: {
    getCurrentAccountUsername: jest.fn(),
    getCurrentPostingKey: jest.fn(),
  },
}));

type PointsAuthServiceModule = typeof import('../pointsAuthService');

function mockFetchOnce(body: unknown, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

// Minimal unsigned JWT with a given exp claim (signature not verified client-side).
function fakeJwt(expSecondsFromNow: number, sub: string = TEST_USERNAME): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString('base64');
  return `${header}.${payload}.sig`;
}

describe('pointsAuthService', () => {
  let pointsAuthService: PointsAuthServiceModule;
  let AsyncStorage: { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };
  let accountStorageService: { getCurrentAccountUsername: jest.Mock; getCurrentPostingKey: jest.Mock };

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();

    pointsAuthService = require('../pointsAuthService');
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    accountStorageService = require('../AccountStorageService').accountStorageService;

    accountStorageService.getCurrentAccountUsername.mockResolvedValue(TEST_USERNAME);
    accountStorageService.getCurrentPostingKey.mockResolvedValue(TEST_POSTING_KEY);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('returns null with no accounts stored, minting nothing', async () => {
    accountStorageService.getCurrentAccountUsername.mockResolvedValue(null);

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a cached, still-fresh token from AsyncStorage without minting a new one', async () => {
    const cachedToken = fakeJwt(3600);
    AsyncStorage.getItem.mockResolvedValue(cachedToken);

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBe(cachedToken);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('mints a fresh token via challenge/sign/verify when nothing is cached', async () => {
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({ token: 'fresh-jwt' });

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBe('fresh-jwt');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [challengeUrl, challengeInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(challengeUrl).toBe('https://snapie.io/api/chat/auth/challenge');
    expect(JSON.parse(challengeInit.body)).toEqual({ username: TEST_USERNAME });

    const [verifyUrl, verifyInit] = (global.fetch as jest.Mock).mock.calls[1];
    expect(verifyUrl).toBe('https://snapie.io/api/chat/auth/verify');
    const verifyBody = JSON.parse(verifyInit.body);
    expect(verifyBody.username).toBe(TEST_USERNAME);
    expect(verifyBody.challenge).toBe('nonce-123');
    expect(typeof verifyBody.signature).toBe('string');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('snapie-points-token', 'fresh-jwt');
  });

  it('discards an expired cached token and mints a fresh one', async () => {
    AsyncStorage.getItem.mockResolvedValue(fakeJwt(-10));
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({ token: 'fresh-jwt' });

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBe('fresh-jwt');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('snapie-points-token');
  });

  it('returns null (no throw) when there is no posting key to sign with', async () => {
    accountStorageService.getCurrentPostingKey.mockResolvedValue(null);

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null (no throw) when the challenge request fails', async () => {
    mockFetchOnce({}, false);

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBeNull();
  });

  it('returns null (no throw) when the verify request fails', async () => {
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({}, false);

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBeNull();
  });

  it('dedupes concurrent mint attempts for the same user into a single mint', async () => {
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({ token: 'fresh-jwt' });

    const [t1, t2] = await Promise.all([
      pointsAuthService.getPointsAuthToken(),
      pointsAuthService.getPointsAuthToken(),
    ]);

    expect(t1).toBe('fresh-jwt');
    expect(t2).toBe('fresh-jwt');
    expect(global.fetch).toHaveBeenCalledTimes(2); // one challenge + one verify, not two
  });

  it("never hands out a cached token issued for another account; mints this account's own", async () => {
    AsyncStorage.getItem.mockResolvedValue(fakeJwt(3600, 'bob'));
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({ token: 'alice-jwt' });

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBe('alice-jwt');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('snapie-points-token');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).username).toBe(TEST_USERNAME);
  });

  it('does not cache a token whose mint finished after the account was switched', async () => {
    mockFetchOnce({ challenge: 'nonce-123' });
    mockFetchOnce({ token: 'alice-jwt' });
    // alice when the mint starts, bob by the time it finishes
    accountStorageService.getCurrentAccountUsername
      .mockResolvedValueOnce(TEST_USERNAME)
      .mockResolvedValue('bob');

    const token = await pointsAuthService.getPointsAuthToken();

    expect(token).toBe('alice-jwt'); // still returned to the caller that asked for alice
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("an older account's mint finishing doesn't undo the newer account's de-duplication", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    (global.fetch as jest.Mock).mockImplementation((url: string, init: { body: string }) => {
      const { username } = JSON.parse(init.body);
      if (String(url).endsWith('/challenge')) {
        // Each account's challenge waits until the test lets it through.
        return new Promise(res => { pending[username] = res; });
      }
      return Promise.resolve({ ok: true, json: async () => ({ token: `${username}-jwt` }) });
    });
    const flush = () => new Promise(r => setImmediate(r));
    const answer = (who: string) => pending[who]({ ok: true, json: async () => ({ challenge: `nonce-${who}` }) });

    const alice = pointsAuthService.getPointsAuthToken();
    await flush();
    accountStorageService.getCurrentAccountUsername.mockResolvedValue('bob');
    const bob1 = pointsAuthService.getPointsAuthToken(); // bob's mint starts, alice's still running
    await flush();
    answer(TEST_USERNAME);
    await alice; // alice's mint ends while bob's is still in flight
    const bob2 = pointsAuthService.getPointsAuthToken(); // must join bob's mint, not start another
    await flush();
    answer('bob');

    expect(await bob1).toBe('bob-jwt');
    expect(await bob2).toBe('bob-jwt');
    const bobChallenges = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, init]) => String(url).endsWith('/challenge') && JSON.parse(init.body).username === 'bob'
    );
    expect(bobChallenges).toHaveLength(1);
  });

  it('clearPointsAuthToken removes the cached token', async () => {
    await pointsAuthService.clearPointsAuthToken();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('snapie-points-token');
  });
});
