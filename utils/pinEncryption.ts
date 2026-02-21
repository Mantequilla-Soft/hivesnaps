import * as Crypto from 'expo-crypto';
import { subtle } from 'react-native-quick-crypto';
import type { CryptoKey } from 'react-native-quick-crypto';

/**
 * PIN-based encryption utility for securing Hive keys
 * Uses PBKDF2 for key derivation and AES-256-GCM for encryption
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a cryptographic key from a PIN using PBKDF2
 * @param pin - 6-digit numeric PIN
 * @param salt - Base64-encoded salt
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromPin(pin: string, salt: string): Promise<CryptoKey> {
    // Convert PIN to bytes
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);

    // Decode salt from base64
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

    // Import PIN as raw key material
    const keyMaterial = await subtle.importKey(
        'raw',
        pinBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    // Derive AES-GCM key using PBKDF2
    const derivedKey = await subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    return derivedKey;
}

/**
 * Encrypts data with a PIN
 * @param data - String data to encrypt (e.g., posting key)
 * @param pin - 6-digit numeric PIN
 * @returns Object containing encrypted data, salt, and IV (all base64-encoded)
 */
export async function encryptWithPin(
    data: string,
    pin: string
): Promise<{ encrypted: string; salt: string; iv: string }> {
    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
        throw new Error('PIN must be exactly 6 digits');
    }

    // Generate random salt
    const saltBytes = await Crypto.getRandomBytesAsync(SALT_LENGTH);
    const salt = btoa(String.fromCharCode(...saltBytes));

    // Generate random IV
    const ivBytes = await Crypto.getRandomBytesAsync(IV_LENGTH);
    const iv = btoa(String.fromCharCode(...ivBytes));

    // Derive key from PIN
    const key = await deriveKeyFromPin(pin, salt);

    // Encrypt data
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Ensure IV is proper BufferSource by creating new Uint8Array
    const ivBuffer = new Uint8Array(ivBytes);

    const encryptedBytes = await subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: ivBuffer,
        },
        key,
        dataBytes
    );

    // Convert to base64
    const encrypted = btoa(
        String.fromCharCode(...new Uint8Array(encryptedBytes))
    );

    return { encrypted, salt, iv };
}

/**
 * Decrypts data with a PIN
 * @param encrypted - Base64-encoded encrypted data
 * @param pin - 6-digit numeric PIN
 * @param salt - Base64-encoded salt used during encryption
 * @param iv - Base64-encoded IV used during encryption
 * @returns Decrypted string data
 * @throws Error if decryption fails (wrong PIN or corrupted data)
 */
export async function decryptWithPin(
    encrypted: string,
    pin: string,
    salt: string,
    iv: string
): Promise<string> {
    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
        throw new Error('PIN must be exactly 6 digits');
    }

    try {
        // Derive key from PIN
        const key = await deriveKeyFromPin(pin, salt);

        // Decode encrypted data and IV from base64
        const encryptedBytes = Uint8Array.from(atob(encrypted), (c) =>
            c.charCodeAt(0)
        );
        const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

        // Decrypt data
        const decryptedBytes = await subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBytes,
            },
            key,
            encryptedBytes
        );

        // Convert to string
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBytes);
    } catch (error) {
        throw new Error('Failed to decrypt: incorrect PIN or corrupted data');
    }
}

/**
 * Validates PIN format
 * @param pin - PIN string to validate
 * @returns true if PIN is valid (6 digits)
 */
export function validatePinFormat(pin: string): boolean {
    return /^\d{6}$/.test(pin);
}
