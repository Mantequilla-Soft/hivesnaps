/**
 * Mock for react-native-quick-crypto
 * Provides a functional implementation of SubtleCrypto for testing
 */

const crypto = require('crypto');

// Create a mock subtle crypto object that uses Node.js crypto
const subtle = {
  importKey: jest.fn(async (format, keyData, algorithm, extractable, usages) => {
    // Return a mock CryptoKey
    return {
      type: 'secret',
      extractable,
      algorithm,
      usages,
      _keyData: keyData,
    };
  }),

  deriveBits: jest.fn(async (algorithm, baseKey, length) => {
    if (algorithm.name === 'PBKDF2') {
      // Use Node.js crypto.pbkdf2Sync for testing
      return crypto.pbkdf2Sync(
        baseKey._keyData,
        Uint8Array.from(atob(algorithm.salt), (c) => c.charCodeAt(0)),
        algorithm.iterations,
        length / 8,
        algorithm.hash.replace('SHA-', 'sha')
      );
    }
    throw new Error(`Unsupported algorithm: ${algorithm.name}`);
  }),

  deriveKey: jest.fn(async (algorithm, baseKey, derivedKeyAlgorithm, extractable, usages) => {
    const bits = await subtle.deriveBits(algorithm, baseKey, 256); // 256 bits for AES-256
    return {
      type: 'secret',
      extractable,
      algorithm: derivedKeyAlgorithm,
      usages,
      _keyData: new Uint8Array(bits),
    };
  }),

  encrypt: jest.fn(async (algorithm, key, data) => {
    if (algorithm.name === 'AES-GCM') {
      const iv = algorithm.iv;
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        key._keyData,
        iv
      );
      const encrypted = cipher.update(data);
      const final = cipher.final();
      const tag = cipher.getAuthTag();

      // Combine encrypted data + tag
      return Buffer.concat([encrypted, final, tag]);
    }
    throw new Error(`Unsupported algorithm: ${algorithm.name}`);
  }),

  decrypt: jest.fn(async (algorithm, key, encryptedData) => {
    if (algorithm.name === 'AES-GCM') {
      const iv = algorithm.iv;
      // Last 16 bytes are the tag
      const tag = encryptedData.slice(-16);
      const data = encryptedData.slice(0, -16);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key._keyData,
        iv
      );
      decipher.setAuthTag(tag);

      try {
        const decrypted = decipher.update(data);
        const final = decipher.final();
        return Buffer.concat([decrypted, final]);
      } catch (error) {
        throw new Error('Decryption failed - invalid PIN or corrupted data');
      }
    }
    throw new Error(`Unsupported algorithm: ${algorithm.name}`);
  }),

  getRandomValues: jest.fn((arr) => {
    const randomBytes = crypto.randomBytes(arr.length);
    arr.set(randomBytes);
    return arr;
  }),
};

// Export as both named and default for compatibility
module.exports = {
  subtle,
  getRandomValues: (arr) => {
    const randomBytes = crypto.randomBytes(arr.length);
    arr.set(randomBytes);
    return arr;
  },
};

// Also support named imports
module.exports.subtle = subtle;
