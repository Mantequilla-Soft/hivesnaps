// Jest setup for Expo and crypto tests
const { TextEncoder, TextDecoder } = require('util');
const crypto = require('crypto');

// Polyfill TextEncoder/TextDecoder if needed
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (length) => {
    return new Uint8Array(crypto.randomBytes(length));
  }),
  digest: jest.fn(),
  randomUUID: jest.fn(() => 'mock-uuid'),
  CryptoDigestAlgorithm: {
    SHA1: 'SHA1',
    SHA256: 'SHA256',
    SHA384: 'SHA384',
    SHA512: 'SHA512',
  },
}));

// Suppress warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Non-serializable values were found in the navigation state')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
