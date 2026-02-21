/**
 * Manual mock for react-native-quick-crypto
 * Jest will automatically use files in __mocks__ when mocking modules
 */

const crypto = require('crypto');

// Create a mock subtle crypto object that uses Node.js crypto
const subtle = {
  importKey: async (format, keyData, algorithm, extractable, usages) => {
    // Return a mock CryptoKey
    return {
      type: 'secret',
      extractable,
      algorithm,
      usages,
      _keyData: keyData,
    };
  },

  deriveBits: async (algorithm, baseKey, length) => {
    if (algorithm.name === 'PBKDF2') {
      // Handle salt - it's already a Uint8Array from deriveKeyFromPin
      let saltBytes = algorithm.salt;
      if (typeof algorithm.salt === 'string') {
        saltBytes = Uint8Array.from(atob(algorithm.salt), (c) => c.charCodeAt(0));
      }

      // Use Node.js crypto.pbkdf2Sync for testing
      return crypto.pbkdf2Sync(
        baseKey._keyData,
        saltBytes,
        algorithm.iterations,
        length / 8,
        algorithm.hash.replace('SHA-', 'sha')
      );
    }
    throw new Error(`Unsupported algorithm: ${algorithm.name}`);
  },

  deriveKey: async (algorithm, baseKey, derivedKeyAlgorithm, extractable, usages) => {
    const bits = await subtle.deriveBits(algorithm, baseKey, 256); // 256 bits for AES-256
    return {
      type: 'secret',
      extractable,
      algorithm: derivedKeyAlgorithm,
      usages,
      _keyData: new Uint8Array(bits),
    };
  },

  encrypt: async (algorithm, key, data) => {
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
  },

  decrypt: async (algorithm, key, encryptedData) => {
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
  },

  getRandomValues: (arr) => {
    const randomBytes = crypto.randomBytes(arr.length);
    arr.set(randomBytes);
    return arr;
  },
};

module.exports = {
  subtle,
  getRandomValues: (arr) => {
    const randomBytes = crypto.randomBytes(arr.length);
    arr.set(randomBytes);
    return arr;
  },
};
