/**
 * Tests for makeAuthenticatedRequest
 * Covers token injection, 401/expired handling, refresh flow, and logout-on-failure.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../AccountStorageService', () => ({
    accountStorageService: {
        clearCurrentAccountUsername: jest.fn(),
    },
}));

jest.mock('../AuthService', () => ({
    authService: {
        getToken: jest.fn(),
        logout: jest.fn(),
        refreshTokenWithRefreshToken: jest.fn(),
    },
}));

jest.mock('../networking', () => ({
    makeRequest: jest.fn(),
}));

import { makeAuthenticatedRequest } from '../AuthenticatedRequest';
import { accountStorageService } from '../AccountStorageService';
import { authService } from '../AuthService';
import { makeRequest } from '../networking';

const mockMakeRequest = makeRequest as jest.Mock;
const mockGetToken = authService.getToken as jest.Mock;
const mockLogout = authService.logout as jest.Mock;
const mockRefresh = authService.refreshTokenWithRefreshToken as jest.Mock;
const mockClearAccount = accountStorageService.clearCurrentAccountUsername as jest.Mock;

const successResponse = { body: { data: 'ok' }, status: 200 };
const expiredError = new Error('HTTP 401: {"error":"token expired"}');
const otherError = new Error('HTTP 403: {"error":"forbidden"}');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetToken.mockReturnValue('valid-jwt-token');
    });

    // ─── Happy path ──────────────────────────────────────────────────────────

    it('attaches Authorization header and returns response', async () => {
        mockMakeRequest.mockResolvedValue(successResponse);

        const result = await makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' });

        expect(mockMakeRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer valid-jwt-token' }),
            })
        );
        expect(result).toEqual(successResponse);
    });

    it('allows request without token when requireAuth is false', async () => {
        mockGetToken.mockReturnValue(null);
        mockMakeRequest.mockResolvedValue(successResponse);

        const result = await makeAuthenticatedRequest({
            url: '/api/public',
            method: 'GET',
            requireAuth: false,
        });

        expect(result).toEqual(successResponse);
        expect(mockMakeRequest).toHaveBeenCalledWith(
            expect.not.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) })
        );
    });

    it('throws immediately when requireAuth is true and no token', async () => {
        mockGetToken.mockReturnValue(null);

        await expect(
            makeAuthenticatedRequest({ url: '/api/protected', method: 'GET' })
        ).rejects.toThrow('Authentication required but no token available');

        expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    // ─── Token refresh ───────────────────────────────────────────────────────

    it('refreshes token on 401 expired and retries the original request', async () => {
        mockMakeRequest
            .mockRejectedValueOnce(expiredError)
            .mockResolvedValueOnce(successResponse);
        mockRefresh.mockResolvedValue('new-jwt-token');

        const result = await makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockMakeRequest).toHaveBeenCalledTimes(2);
        // Retry must use the new token
        expect(mockMakeRequest).toHaveBeenLastCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer new-jwt-token' }),
            })
        );
        expect(result).toEqual(successResponse);
    });

    // ─── Refresh failure → logout ─────────────────────────────────────────────

    it('calls authService.logout() and clearCurrentAccountUsername() when refresh fails', async () => {
        mockMakeRequest.mockRejectedValueOnce(expiredError);
        mockRefresh.mockRejectedValue(new Error('Refresh token invalid'));
        mockClearAccount.mockResolvedValue(undefined);

        await expect(
            makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' })
        ).rejects.toThrow('Authentication expired. Please log in again.');

        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(mockClearAccount).toHaveBeenCalledTimes(1);
    });

    it('still throws auth-expired error even if clearCurrentAccountUsername fails', async () => {
        mockMakeRequest.mockRejectedValueOnce(expiredError);
        mockRefresh.mockRejectedValue(new Error('Refresh token invalid'));
        mockClearAccount.mockRejectedValue(new Error('Storage error'));

        await expect(
            makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' })
        ).rejects.toThrow('Authentication expired. Please log in again.');

        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    // ─── Non-expired 401 ────────────────────────────────────────────────────

    it('does not refresh on a 401 that is not an expired-token error', async () => {
        mockMakeRequest.mockRejectedValueOnce(new Error('HTTP 401: {"error":"unauthorized"}'));

        await expect(
            makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' })
        ).rejects.toThrow('HTTP 401');

        expect(mockRefresh).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
    });

    // ─── Non-401 errors ─────────────────────────────────────────────────────

    it('passes through non-401 errors without attempting refresh', async () => {
        mockMakeRequest.mockRejectedValueOnce(otherError);

        await expect(
            makeAuthenticatedRequest({ url: '/api/feed', method: 'GET' })
        ).rejects.toThrow('HTTP 403');

        expect(mockRefresh).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
    });
});
