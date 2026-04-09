/**
 * Tests for useAuth hook
 * Focuses on logout ordering and switchAccount error handling — the two behaviours
 * that were explicitly fixed during the multi-account implementation.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../services/AccountStorageService', () => ({
    accountStorageService: {
        clearCurrentAccountUsername: jest.fn(),
        getAccountKeys: jest.fn(),
        setCurrentAccountUsername: jest.fn(),
    },
}));

jest.mock('../../services/AuthService', () => ({
    authService: {
        logout: jest.fn(),
        authenticate: jest.fn(),
        getToken: jest.fn().mockReturnValue(null),
        getRefreshToken: jest.fn().mockReturnValue(null),
    },
}));

jest.mock('../../store/context', () => ({
    useAppStore: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useAuth } from '../useAuth';
import { accountStorageService } from '../../services/AccountStorageService';
import { authService } from '../../services/AuthService';
import { useAppStore } from '../../store/context';

const mockClearCurrentAccountUsername = accountStorageService.clearCurrentAccountUsername as jest.Mock;
const mockGetAccountKeys = accountStorageService.getAccountKeys as jest.Mock;
const mockSetCurrentAccountUsername = accountStorageService.setCurrentAccountUsername as jest.Mock;
const mockAuthServiceLogout = authService.logout as jest.Mock;
const mockAuthServiceAuthenticate = authService.authenticate as jest.Mock;
const mockGetToken = authService.getToken as jest.Mock;
const mockUseAppStore = useAppStore as jest.Mock;

// ─── Store factory ────────────────────────────────────────────────────────────

function makeStore() {
    const mockSetAuthTokens = jest.fn();
    const mockSetAuthLoading = jest.fn();
    const mockSetAuthError = jest.fn();
    const mockClearAuth = jest.fn();
    const mockSetCurrentUser = jest.fn();
    const mockSetHasActiveKey = jest.fn();

    mockUseAppStore.mockReturnValue({
        setAuthTokens: mockSetAuthTokens,
        setAuthLoading: mockSetAuthLoading,
        setAuthError: mockSetAuthError,
        clearAuth: mockClearAuth,
        setCurrentUser: mockSetCurrentUser,
        setHasActiveKey: mockSetHasActiveKey,
        selectors: {
            getAuthToken: jest.fn().mockReturnValue(null),
            getAuthRefreshToken: jest.fn().mockReturnValue(null),
            isAuthenticated: jest.fn().mockReturnValue(false),
            isAuthLoading: jest.fn().mockReturnValue(false),
            getAuthError: jest.fn().mockReturnValue(null),
            isAuthenticationFresh: jest.fn().mockReturnValue(false),
            getCurrentUser: jest.fn().mockReturnValue(null),
            getHasActiveKey: jest.fn().mockReturnValue(false),
        },
    });

    return { mockSetAuthError, mockClearAuth, mockSetCurrentUser, mockSetHasActiveKey, mockSetAuthLoading, mockSetAuthTokens };
}

// ─── Hook renderer ────────────────────────────────────────────────────────────

type AuthHook = ReturnType<typeof useAuth>;

function renderUseAuth(): { result: AuthHook } {
    const container: { result: AuthHook } = { result: null as unknown as AuthHook };
    const TestComponent = () => { container.result = useAuth(); return null; };
    act(() => { create(React.createElement(TestComponent)); });
    return container;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetToken.mockReturnValue(null);
    });

    // ─── logout ──────────────────────────────────────────────────────────────

    describe('logout', () => {
        it('clears persisted account BEFORE clearing in-memory state', async () => {
            const { mockClearAuth, mockSetCurrentUser } = makeStore();
            const callOrder: string[] = [];

            mockClearCurrentAccountUsername.mockImplementation(async () => {
                callOrder.push('clearCurrentAccountUsername');
            });
            mockAuthServiceLogout.mockImplementation(() => callOrder.push('authService.logout'));
            mockClearAuth.mockImplementation(() => callOrder.push('clearAuth'));
            mockSetCurrentUser.mockImplementation(() => callOrder.push('setCurrentUser'));

            const { result } = renderUseAuth();
            await act(async () => { await result.logout(); });

            expect(callOrder[0]).toBe('clearCurrentAccountUsername');
            expect(callOrder.indexOf('clearCurrentAccountUsername'))
                .toBeLessThan(callOrder.indexOf('authService.logout'));
            expect(callOrder.indexOf('clearCurrentAccountUsername'))
                .toBeLessThan(callOrder.indexOf('clearAuth'));
        });

        it('clears all in-memory auth state after persisted account is cleared', async () => {
            const { mockClearAuth, mockSetCurrentUser, mockSetHasActiveKey } = makeStore();
            mockClearCurrentAccountUsername.mockResolvedValue(undefined);

            const { result } = renderUseAuth();
            await act(async () => { await result.logout(); });

            expect(mockAuthServiceLogout).toHaveBeenCalledTimes(1);
            expect(mockClearAuth).toHaveBeenCalledTimes(1);
            expect(mockSetCurrentUser).toHaveBeenCalledWith(null);
            expect(mockSetHasActiveKey).toHaveBeenCalledWith(false);
        });

        it('throws and does NOT clear in-memory state if storage clear fails', async () => {
            const { mockClearAuth, mockSetCurrentUser } = makeStore();
            mockClearCurrentAccountUsername.mockRejectedValue(new Error('SecureStore unavailable'));

            const { result } = renderUseAuth();
            await expect(
                act(async () => { await result.logout(); })
            ).rejects.toThrow('SecureStore unavailable');

            expect(mockAuthServiceLogout).not.toHaveBeenCalled();
            expect(mockClearAuth).not.toHaveBeenCalled();
            expect(mockSetCurrentUser).not.toHaveBeenCalled();
        });
    });

    // ─── switchAccount ───────────────────────────────────────────────────────

    describe('switchAccount', () => {
        it('throws if no keys are found for the account', async () => {
            const { mockSetCurrentUser } = makeStore();
            mockGetAccountKeys.mockResolvedValue(null);

            const { result } = renderUseAuth();
            await expect(
                act(async () => { await result.switchAccount('unknownuser'); })
            ).rejects.toThrow('No keys found for account @unknownuser');

            expect(mockSetCurrentUser).not.toHaveBeenCalled();
        });

        it('sets current account in storage and updates store', async () => {
            const { mockSetCurrentUser, mockSetHasActiveKey } = makeStore();
            mockGetAccountKeys.mockResolvedValue({ postingKey: 'posting123', activeKey: undefined });
            mockSetCurrentAccountUsername.mockResolvedValue(undefined);
            mockAuthServiceAuthenticate.mockResolvedValue({ success: true, token: 'tok' });
            mockGetToken.mockReturnValue('tok');

            const { result } = renderUseAuth();
            await act(async () => { await result.switchAccount('newuser'); });

            expect(mockSetCurrentAccountUsername).toHaveBeenCalledWith('newuser');
            expect(mockSetCurrentUser).toHaveBeenCalledWith('newuser');
            expect(mockSetHasActiveKey).toHaveBeenCalledWith(false);
        });

        it('sets hasActiveKey true when account has an active key', async () => {
            const { mockSetHasActiveKey } = makeStore();
            mockGetAccountKeys.mockResolvedValue({ postingKey: 'posting123', activeKey: 'active456' });
            mockSetCurrentAccountUsername.mockResolvedValue(undefined);
            mockAuthServiceAuthenticate.mockResolvedValue({ success: true, token: 'tok' });
            mockGetToken.mockReturnValue('tok');

            const { result } = renderUseAuth();
            await act(async () => { await result.switchAccount('newuser'); });

            expect(mockSetHasActiveKey).toHaveBeenCalledWith(true);
        });

        it('does NOT throw when JWT re-auth fails — account switch still completes', async () => {
            const { mockSetCurrentUser, mockSetHasActiveKey } = makeStore();
            mockGetAccountKeys.mockResolvedValue({ postingKey: 'posting123' });
            mockSetCurrentAccountUsername.mockResolvedValue(undefined);
            // authenticate() handles errors internally and returns false — it does not throw
            mockAuthServiceAuthenticate.mockRejectedValue(new Error('Server unreachable'));

            const { result } = renderUseAuth();
            // Should resolve (not reject) even when JWT fails
            await act(async () => { await result.switchAccount('newuser'); });

            // Store must still be updated to the new account
            expect(mockSetCurrentUser).toHaveBeenCalledWith('newuser');
            expect(mockSetHasActiveKey).toHaveBeenCalledWith(false);
        });

        it('persists account switch before attempting JWT', async () => {
            makeStore();
            const callOrder: string[] = [];
            mockGetAccountKeys.mockResolvedValue({ postingKey: 'posting123' });
            mockSetCurrentAccountUsername.mockImplementation(async () => {
                callOrder.push('setCurrentAccountUsername');
            });
            mockAuthServiceAuthenticate.mockImplementation(async () => {
                callOrder.push('authenticate');
                return { success: true, token: 'tok' };
            });
            mockGetToken.mockReturnValue('tok');

            const { result } = renderUseAuth();
            await act(async () => { await result.switchAccount('newuser'); });

            expect(callOrder.indexOf('setCurrentAccountUsername'))
                .toBeLessThan(callOrder.indexOf('authenticate'));
        });
    });
});
