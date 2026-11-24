/**
 * AuthService sign-in is single-flight per user: the backend keeps only the
 * latest challenge for a user, so overlapping sign-ins made one fail with
 * "Invalid challenge" (#262).
 */
jest.mock('../networking', () => ({ makeRequest: jest.fn() }));
jest.mock('../../app/config/env', () => ({ BASE_API_URL: 'https://api.test' }));

import { PrivateKey } from '@hiveio/dhive';
import { makeRequest } from '../networking';
import { authService } from '../AuthService';

const mockRequest = makeRequest as jest.Mock;
const postingKey = PrivateKey.fromSeed('hivesnaps-auth-test').toString();

/** A fake backend that, like the real one, only accepts the latest challenge per user. */
function fakeBackend(): { challenges: number } {
    const latest = new Map<string, string>();
    const stats = { challenges: 0 };
    mockRequest.mockImplementation(async ({ path, body }: { path: string; body: Record<string, unknown> }) => {
        await new Promise((r) => setTimeout(r, 5));
        if (path === '/auth/challenge') {
            stats.challenges++;
            const challenge = `c${stats.challenges}`;
            latest.set(body.username as string, challenge);
            return { status: 200, body: { challenge, timestamp: 1000 + stats.challenges } };
        }
        if (path === '/auth/verify') {
            if (latest.get(body.username as string) !== body.challenge) throw new Error('HTTP 400: {"error":"Invalid challenge"}');
            return { status: 200, body: { token: `jwt-${body.challenge}`, refreshToken: 'r' } };
        }
        throw new Error(`unexpected ${path}`);
    });
    return stats;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    authService.logout();
});

afterEach(() => jest.restoreAllMocks());

it('overlapping sign-ins for the same user share one challenge and both succeed', async () => {
    const backend = fakeBackend();
    const [a, b] = await Promise.all([
        authService.authenticate('meno', postingKey),
        authService.authenticate('Meno', postingKey),
    ]);
    expect(backend.challenges).toBe(1);
    expect(a).toEqual({ success: true, token: 'jwt-c1' });
    expect(b).toBe(a);
    expect(authService.getToken()).toBe('jwt-c1');
});

it('starts a fresh sign-in once the previous one has finished', async () => {
    const backend = fakeBackend();
    await authService.authenticate('meno', postingKey);
    const again = await authService.authenticate('meno', postingKey);
    expect(backend.challenges).toBe(2);
    expect(again.token).toBe('jwt-c2');
});

it('different users sign in independently', async () => {
    const backend = fakeBackend();
    const [a, b] = await Promise.all([
        authService.authenticate('alice', postingKey),
        authService.authenticate('bob', postingKey),
    ]);
    expect(backend.challenges).toBe(2);
    expect(a.success && b.success).toBe(true);
});

it('a failed sign-in is not reused by later calls', async () => {
    mockRequest.mockRejectedValueOnce(new Error('offline'));
    const failed = await authService.authenticate('meno', postingKey);
    expect(failed.success).toBe(false);
    const backend = fakeBackend();
    const ok = await authService.authenticate('meno', postingKey);
    expect(ok.success).toBe(true);
    expect(backend.challenges).toBe(1);
});
