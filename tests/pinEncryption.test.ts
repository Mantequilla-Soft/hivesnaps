/**
 * Tests for pinEncryption utility
 * Tests PIN-based encryption/decryption with PBKDF2 and AES-256-GCM
 */

import {
    encryptWithPin,
    decryptWithPin,
    validatePinFormat,
} from '../utils/pinEncryption';

describe('pinEncryption', () => {
    const validPin = '123456';
    const wrongPin = '654321';
    const invalidPin = '12345'; // Only 5 digits
    const testData = 'hive_posting_key_example_data';

    describe('validatePinFormat', () => {
        it('should accept valid 6-digit PINs', () => {
            expect(validatePinFormat('000000')).toBe(true);
            expect(validatePinFormat('999999')).toBe(true);
            expect(validatePinFormat('123456')).toBe(true);
        });

        it('should reject PINs with fewer than 6 digits', () => {
            expect(validatePinFormat('12345')).toBe(false);
            expect(validatePinFormat('1234')).toBe(false);
            expect(validatePinFormat('')).toBe(false);
        });

        it('should reject PINs with more than 6 digits', () => {
            expect(validatePinFormat('1234567')).toBe(false);
            expect(validatePinFormat('12345678')).toBe(false);
        });

        it('should reject non-numeric PINs', () => {
            expect(validatePinFormat('12345a')).toBe(false);
            expect(validatePinFormat('abcdef')).toBe(false);
            expect(validatePinFormat('123-456')).toBe(false);
        });
    });

    describe('encryptWithPin', () => {
        it('should successfully encrypt data with valid PIN', async () => {
            const result = await encryptWithPin(testData, validPin);

            expect(result).toHaveProperty('encrypted');
            expect(result).toHaveProperty('salt');
            expect(result).toHaveProperty('iv');
            expect(typeof result.encrypted).toBe('string');
            expect(typeof result.salt).toBe('string');
            expect(typeof result.iv).toBe('string');
        });

        it('should return base64-encoded values', async () => {
            const result = await encryptWithPin(testData, validPin);

            // Base64 strings should be decodable without errors
            expect(() => atob(result.encrypted)).not.toThrow();
            expect(() => atob(result.salt)).not.toThrow();
            expect(() => atob(result.iv)).not.toThrow();
        });

        it('should generate different salt and IV for each encryption', async () => {
            const result1 = await encryptWithPin(testData, validPin);
            const result2 = await encryptWithPin(testData, validPin);

            // Same data with same PIN should produce different ciphertexts
            // because salt and IV are randomized
            expect(result1.encrypted).not.toBe(result2.encrypted);
            expect(result1.salt).not.toBe(result2.salt);
            expect(result1.iv).not.toBe(result2.iv);
        });

        it('should reject invalid PIN format', async () => {
            await expect(encryptWithPin(testData, invalidPin)).rejects.toThrow(
                'PIN must be exactly 6 digits'
            );
        });

        it('should handle special characters in data', async () => {
            const specialData =
                'special!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"data';
            const result = await encryptWithPin(specialData, validPin);

            expect(result).toHaveProperty('encrypted');
            expect(result).toHaveProperty('salt');
            expect(result).toHaveProperty('iv');
        });

        it('should handle empty data', async () => {
            const result = await encryptWithPin('', validPin);

            expect(result).toHaveProperty('encrypted');
            expect(result).toHaveProperty('salt');
            expect(result).toHaveProperty('iv');
        });

        it('should handle long data', async () => {
            const longData = 'a'.repeat(10000);
            const result = await encryptWithPin(longData, validPin);

            expect(result).toHaveProperty('encrypted');
            expect(typeof result.encrypted).toBe('string');
            expect(result.encrypted.length).toBeGreaterThan(0);
        });

        it('should handle Unicode characters', async () => {
            const unicodeData = '你好世界 🔐 مرحبا';
            const result = await encryptWithPin(unicodeData, validPin);

            expect(result).toHaveProperty('encrypted');
            expect(result).toHaveProperty('salt');
        });
    });

    describe('decryptWithPin', () => {
        it('should successfully decrypt with correct PIN', async () => {
            const encrypted = await encryptWithPin(testData, validPin);
            const decrypted = await decryptWithPin(
                encrypted.encrypted,
                validPin,
                encrypted.salt,
                encrypted.iv
            );

            expect(decrypted).toBe(testData);
        });

        it('should fail with wrong PIN', async () => {
            const encrypted = await encryptWithPin(testData, validPin);

            await expect(
                decryptWithPin(encrypted.encrypted, wrongPin, encrypted.salt, encrypted.iv)
            ).rejects.toThrow('Failed to decrypt: incorrect PIN or corrupted data');
        });

        it('should fail with corrupted encrypted data', async () => {
            const encrypted = await encryptWithPin(testData, validPin);
            const corruptedData = btoa('corrupted_data_that_is_not_valid');

            await expect(
                decryptWithPin(
                    corruptedData,
                    validPin,
                    encrypted.salt,
                    encrypted.iv
                )
            ).rejects.toThrow('Failed to decrypt: incorrect PIN or corrupted data');
        });

        it('should fail with invalid PIN format', async () => {
            const encrypted = await encryptWithPin(testData, validPin);

            await expect(
                decryptWithPin(encrypted.encrypted, invalidPin, encrypted.salt, encrypted.iv)
            ).rejects.toThrow('PIN must be exactly 6 digits');
        });

        it('should decrypt empty data correctly', async () => {
            const encrypted = await encryptWithPin('', validPin);
            const decrypted = await decryptWithPin(
                encrypted.encrypted,
                validPin,
                encrypted.salt,
                encrypted.iv
            );

            expect(decrypted).toBe('');
        });

        it('should decrypt special characters correctly', async () => {
            const specialData = 'special!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"data';
            const encrypted = await encryptWithPin(specialData, validPin);
            const decrypted = await decryptWithPin(
                encrypted.encrypted,
                validPin,
                encrypted.salt,
                encrypted.iv
            );

            expect(decrypted).toBe(specialData);
        });

        it('should decrypt Unicode correctly', async () => {
            const unicodeData = '你好世界 🔐 مرحبا';
            const encrypted = await encryptWithPin(unicodeData, validPin);
            const decrypted = await decryptWithPin(
                encrypted.encrypted,
                validPin,
                encrypted.salt,
                encrypted.iv
            );

            expect(decrypted).toBe(unicodeData);
        });
    });

    describe('round-trip encryption/decryption', () => {
        it('should correctly round-trip data with various PINs', async () => {
            const pins = [
                '000000',
                '123456',
                '999999',
                '111111',
            ];

            for (const pin of pins) {
                const encrypted = await encryptWithPin(testData, pin);
                const decrypted = await decryptWithPin(
                    encrypted.encrypted,
                    pin,
                    encrypted.salt,
                    encrypted.iv
                );

                expect(decrypted).toBe(testData);
            }
        });

        it('should correctly round-trip various data types', async () => {
            const testCases = [
                'simple_posting_key',
                'key_with_special_chars_!@#$%',
                'very_long_key_' + 'a'.repeat(1000),
                '你好', // Chinese
                '🔐🔒🗝️', // Emojis
                '', // Empty string
            ];

            for (const data of testCases) {
                const encrypted = await encryptWithPin(data, validPin);
                const decrypted = await decryptWithPin(
                    encrypted.encrypted,
                    validPin,
                    encrypted.salt,
                    encrypted.iv
                );

                expect(decrypted).toBe(data);
            }
        });
    });

    describe('base64 serialization compatibility', () => {
        it('should produce base64 strings compatible across encodings', async () => {
            const encrypted = await encryptWithPin(testData, validPin);

            // Should be able to encode/decode without loss
            const encryptedDecoded = atob(encrypted.encrypted);
            const encryptedReencoded = btoa(encryptedDecoded);
            expect(encryptedReencoded).toBe(encrypted.encrypted);

            const saltDecoded = atob(encrypted.salt);
            const saltReencoded = btoa(saltDecoded);
            expect(saltReencoded).toBe(encrypted.salt);

            const ivDecoded = atob(encrypted.iv);
            const ivReencoded = btoa(ivDecoded);
            expect(ivReencoded).toBe(encrypted.iv);
        });

        it('should handle base64 string storage and retrieval', async () => {
            const encrypted = await encryptWithPin(testData, validPin);

            // Simulate storage and retrieval
            const stored = {
                encrypted: encrypted.encrypted,
                salt: encrypted.salt,
                iv: encrypted.iv,
            };

            // Retrieve and decrypt
            const decrypted = await decryptWithPin(
                stored.encrypted,
                validPin,
                stored.salt,
                stored.iv
            );

            expect(decrypted).toBe(testData);
        });
    });

    describe('security properties', () => {
        it('should produce different ciphertexts for same data with different PINs', async () => {
            const pins = ['000000', '111111', '222222'];
            const ciphertexts = [];

            for (const pin of pins) {
                const encrypted = await encryptWithPin(testData, pin);
                ciphertexts.push(encrypted.encrypted);
            }

            // No two ciphertexts should be identical
            expect(ciphertexts[0]).not.toBe(ciphertexts[1]);
            expect(ciphertexts[1]).not.toBe(ciphertexts[2]);
            expect(ciphertexts[0]).not.toBe(ciphertexts[2]);
        });

        it('should produce different ciphertexts for same data and PIN (randomness)', async () => {
            const encrypted1 = await encryptWithPin(testData, validPin);
            const encrypted2 = await encryptWithPin(testData, validPin);

            // Different salt and IV should result in different ciphertexts
            expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
            expect(encrypted1.salt).not.toBe(encrypted2.salt);
            expect(encrypted1.iv).not.toBe(encrypted2.iv);

            // Both should still decrypt to original data with same PIN
            const decrypted1 = await decryptWithPin(
                encrypted1.encrypted,
                validPin,
                encrypted1.salt,
                encrypted1.iv
            );
            const decrypted2 = await decryptWithPin(
                encrypted2.encrypted,
                validPin,
                encrypted2.salt,
                encrypted2.iv
            );

            expect(decrypted1).toBe(testData);
            expect(decrypted2).toBe(testData);
        });
    });
});
