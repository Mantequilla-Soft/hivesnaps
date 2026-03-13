/**
 * Local Authentication Service
 *
 * Provides biometric (Face ID / Touch ID / Fingerprint) and device passcode
 * authentication using expo-local-authentication.
 *
 * This service is a standalone wrapper that will be consumed by other features
 * (e.g. active-key management, account switching) in later PRs.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import type {
    AuthenticationType,
    SecurityLevel,
} from 'expo-local-authentication';

// ─── Custom Errors ──────────────────────────────────────────────────────────────

/** Thrown when the user explicitly cancels the authentication prompt. */
export class AuthCancelledError extends Error {
    constructor() {
        super('Authentication cancelled');
        this.name = 'AuthCancelledError';
    }
}

/** Thrown when authentication fails for a reason other than cancellation. */
export class AuthFailedError extends Error {
    constructor(reason: string) {
        super(`Authentication failed: ${reason}`);
        this.name = 'AuthFailedError';
    }
}

// ─── Result interfaces ──────────────────────────────────────────────────────────

/** Describes the biometric capabilities of the current device. */
export interface BiometricCapabilities {
    /** Whether biometric hardware is present on the device. */
    hasHardware: boolean;
    /** Whether the user has enrolled at least one biometric credential. */
    isEnrolled: boolean;
    /** The enrolled security level (NONE, SECRET, BIOMETRIC_WEAK, BIOMETRIC_STRONG). */
    securityLevel: SecurityLevel;
    /** The authentication types available (FINGERPRINT, FACIAL_RECOGNITION, IRIS). */
    supportedTypes: AuthenticationType[];
}

// ─── Service Implementation ─────────────────────────────────────────────────────

class LocalAuthServiceImpl {
    /**
     * Prompt the user for biometric or device-passcode authentication.
     *
     * Resolves on success, throws {@link AuthCancelledError} on cancellation,
     * or {@link AuthFailedError} on any other failure.
     *
     * @param promptMessage - Message displayed alongside the biometric prompt.
     */
    async authenticate(
        promptMessage = 'Confirm your identity'
    ): Promise<void> {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage,
            disableDeviceFallback: false,
            cancelLabel: 'Cancel',
        });

        if (result.success) {
            return;
        }

        // Distinguish cancellation from actual failure
        const cancelErrors: ReadonlySet<string> = new Set([
            'user_cancel',
            'system_cancel',
            'app_cancel',
        ]);

        if (cancelErrors.has(result.error)) {
            throw new AuthCancelledError();
        }

        throw new AuthFailedError(result.error);
    }

    /**
     * Query the device's biometric capabilities without triggering a prompt.
     */
    async getCapabilities(): Promise<BiometricCapabilities> {
        const [hasHardware, isEnrolled, securityLevel, supportedTypes] =
            await Promise.all([
                LocalAuthentication.hasHardwareAsync(),
                LocalAuthentication.isEnrolledAsync(),
                LocalAuthentication.getEnrolledLevelAsync(),
                LocalAuthentication.supportedAuthenticationTypesAsync(),
            ]);

        return { hasHardware, isEnrolled, securityLevel, supportedTypes };
    }

    /**
     * Convenience check: returns `true` when the device both has biometric
     * hardware AND the user has enrolled at least one credential.
     */
    async isAvailable(): Promise<boolean> {
        const { hasHardware, isEnrolled } = await this.getCapabilities();
        return hasHardware && isEnrolled;
    }
}

export const localAuthService = new LocalAuthServiceImpl();
