jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../pointsAuthService', () => ({
    ...jest.requireActual('../pointsAuthService'),
    getPointsAuthToken: jest.fn(),
}));

import { makeFilterRequest, resyncContentFilters, RESYNC_MIN_INTERVAL_MS, tokenAccount } from '../contentFilter';

const jwtFor = (sub: string): string =>
    `x.${Buffer.from(JSON.stringify({ sub, exp: 9999999999 })).toString('base64url')}.y`;

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
});

it('reads the account a token was issued for', () => {
    expect(tokenAccount(jwtFor('Meno'))).toBe('meno');
    expect(tokenAccount('not-a-jwt')).toBeNull();
});

it("sends the account's own token to snapie.io", async () => {
    const request = makeFilterRequest('meno', async () => jwtFor('meno'));
    const res = await request('/api/user/content-filters', { method: 'GET', headers: { Accept: 'application/json' } });
    expect(res).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('https://snapie.io/api/user/content-filters', {
        method: 'GET',
        signal: expect.any(AbortSignal),
        headers: { Accept: 'application/json', Authorization: `Bearer ${jwtFor('meno')}` },
    });
});

it("refuses another account's token (e.g. one left over right after switching)", async () => {
    const request = makeFilterRequest('alice', async () => jwtFor('meno'));
    await expect(request('/api/user/content-filters', { method: 'PUT' })).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});

it('sends nothing without a token', async () => {
    const request = makeFilterRequest('meno', async () => null);
    await expect(request('/api/user/content-filters', { method: 'GET' })).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});

it('gives up on a sync request that never answers', async () => {
    jest.useFakeTimers();
    try {
        let signal: AbortSignal | undefined;
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            signal = init.signal ?? undefined;
            return new Promise((_res, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));
        }) as unknown as typeof fetch;
        const request = makeFilterRequest('meno', async () => jwtFor('meno'));
        const pending = request('/api/user/content-filters', { method: 'GET' });
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(15_000);
        await expect(pending).rejects.toThrow('aborted');
        expect(signal?.aborted).toBe(true);
    } finally {
        jest.useRealTimers();
    }
});

it('re-syncs on foreground at most once a minute, and never when signed out', async () => {
    const start = Date.now();
    expect(resyncContentFilters(null, start)).toBeNull();
    const first = resyncContentFilters('meno', start + RESYNC_MIN_INTERVAL_MS * 10);
    expect(first).not.toBeNull();
    await first;
    expect(resyncContentFilters('meno', Date.now() + 1_000)).toBeNull();
    const later = resyncContentFilters('meno', Date.now() + RESYNC_MIN_INTERVAL_MS + 1_000);
    expect(later).not.toBeNull();
    await later;
});
