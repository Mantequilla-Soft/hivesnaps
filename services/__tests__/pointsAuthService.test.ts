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
function fakeJwt(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub: TEST_USERNAME, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString('base64');
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

  it('clearPointsAuthToken removes the cached token', async () => {
    await pointsAuthService.clearPointsAuthToken();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('snapie-points-token');
  });
});
