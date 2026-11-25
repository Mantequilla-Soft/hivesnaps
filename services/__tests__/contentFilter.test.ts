jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../pointsAuthService', () => ({ getPointsAuthToken: jest.fn() }));

import { makeFilterRequest, tokenAccount } from '../contentFilter';

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
