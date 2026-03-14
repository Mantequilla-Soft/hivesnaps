/**
 * Tests for LocalAuthService
 * Tests biometric/device authentication, cancellation, failure, and capability queries.
 */

import * as LocalAuthentication from 'expo-local-authentication';

const { AuthenticationType, SecurityLevel } = jest.requireActual(
    'expo-local-authentication'
) as typeof LocalAuthentication;

jest.mock('expo-local-authentication');

// Import service AFTER mocks are set up
import {
    localAuthService,
    AuthCancelledError,
    AuthFailedError,
} from '../LocalAuthService';

const mockedAuth = jest.mocked(LocalAuthentication);

describe('LocalAuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── authenticate ────────────────────────────────────────────────────────

    describe('authenticate', () => {
        it('resolves on successful authentication', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({ success: true });

            await expect(localAuthService.authenticate()).resolves.toBeUndefined();

            expect(mockedAuth.authenticateAsync).toHaveBeenCalledWith({
                promptMessage: 'Confirm your identity',
                disableDeviceFallback: false,
                cancelLabel: 'Cancel',
            });
        });

        it('uses a custom prompt message when provided', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({ success: true });

            await localAuthService.authenticate('Unlock wallet');

            expect(mockedAuth.authenticateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ promptMessage: 'Unlock wallet' })
            );
        });

        it('throws AuthCancelledError on user_cancel', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'user_cancel',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthCancelledError
            );
        });

        it('throws AuthCancelledError on system_cancel', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'system_cancel',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthCancelledError
            );
        });

        it('throws AuthCancelledError on app_cancel', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'app_cancel',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthCancelledError
            );
        });

        it('throws AuthFailedError with reason on lockout', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'lockout',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthFailedError
            );
            await expect(localAuthService.authenticate()).rejects.toThrow(
                'lockout'
            );
        });

        it('throws AuthFailedError on not_enrolled', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'not_enrolled',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthFailedError
            );
        });

        it('throws AuthFailedError on authentication_failed', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'authentication_failed',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthFailedError
            );
        });

        it('throws AuthFailedError on unknown error', async () => {
            mockedAuth.authenticateAsync.mockResolvedValue({
                success: false,
                error: 'unknown',
            });

            await expect(localAuthService.authenticate()).rejects.toThrow(
                AuthFailedError
            );
        });
    });

    // ─── getCapabilities ─────────────────────────────────────────────────────

    describe('getCapabilities', () => {
        it('returns full capability info when biometrics are available', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(true);
            mockedAuth.isEnrolledAsync.mockResolvedValue(true);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.BIOMETRIC_STRONG
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
                AuthenticationType.FINGERPRINT,
                AuthenticationType.FACIAL_RECOGNITION,
            ]);

            const result = await localAuthService.getCapabilities();

            expect(result).toEqual({
                hasHardware: true,
                isEnrolled: true,
                securityLevel: SecurityLevel.BIOMETRIC_STRONG,
                supportedTypes: [
                    AuthenticationType.FINGERPRINT,
                    AuthenticationType.FACIAL_RECOGNITION,
                ],
            });
        });

        it('returns hasHardware false when no biometric hardware', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(false);
            mockedAuth.isEnrolledAsync.mockResolvedValue(false);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.NONE
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([]);

            const result = await localAuthService.getCapabilities();

            expect(result.hasHardware).toBe(false);
            expect(result.isEnrolled).toBe(false);
            expect(result.securityLevel).toBe(SecurityLevel.NONE);
            expect(result.supportedTypes).toEqual([]);
        });

        it('handles hardware present but not enrolled', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(true);
            mockedAuth.isEnrolledAsync.mockResolvedValue(false);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.NONE
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
                AuthenticationType.FINGERPRINT,
            ]);

            const result = await localAuthService.getCapabilities();

            expect(result.hasHardware).toBe(true);
            expect(result.isEnrolled).toBe(false);
        });
    });

    // ─── isAvailable ─────────────────────────────────────────────────────────

    describe('isAvailable', () => {
        it('returns true when biometrics are enrolled', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(true);
            mockedAuth.isEnrolledAsync.mockResolvedValue(true);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.BIOMETRIC_STRONG
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
                AuthenticationType.FINGERPRINT,
            ]);

            await expect(localAuthService.isAvailable()).resolves.toBe(true);
        });

        it('returns true when only device passcode is set (SECRET level)', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(false);
            mockedAuth.isEnrolledAsync.mockResolvedValue(false);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.SECRET
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([]);

            await expect(localAuthService.isAvailable()).resolves.toBe(true);
        });

        it('returns false when security level is NONE', async () => {
            mockedAuth.hasHardwareAsync.mockResolvedValue(false);
            mockedAuth.isEnrolledAsync.mockResolvedValue(false);
            mockedAuth.getEnrolledLevelAsync.mockResolvedValue(
                SecurityLevel.NONE
            );
            mockedAuth.supportedAuthenticationTypesAsync.mockResolvedValue([]);

            await expect(localAuthService.isAvailable()).resolves.toBe(false);
        });
    });

    // ─── Error classes ───────────────────────────────────────────────────────

    describe('error classes', () => {
        it('AuthCancelledError has correct name and message', () => {
            const error = new AuthCancelledError();
            expect(error.name).toBe('AuthCancelledError');
            expect(error.message).toBe('Authentication cancelled');
            expect(error).toBeInstanceOf(Error);
        });

        it('AuthFailedError has correct name and includes reason', () => {
            const error = new AuthFailedError('lockout');
            expect(error.name).toBe('AuthFailedError');
            expect(error.message).toBe('Authentication failed: lockout');
            expect(error).toBeInstanceOf(Error);
        });
    });
});
