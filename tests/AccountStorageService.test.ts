/**
 * Tests for AccountStorageService
 * Tests multi-account storage, key management, and validation
 */

import * as SecureStore from 'expo-secure-store';
import { Client, PrivateKey } from '@hiveio/dhive';

// Mock data
const mockUsername = 'testuser';
const mockPostingKey = '5TestPostingKeyABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
const mockActiveKey = '5TestActiveKeyABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
const mockPublicKey = 'STM5TestPublicKeyABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Mock Hive account data
const mockHiveAccount = {
    name: mockUsername,
    posting: {
        key_auths: [[mockPublicKey, 1]],
    },
    active: {
        key_auths: [[mockPublicKey, 1]],
    },
};

// Create shared mocks that will be used across tests
let mockGetAccounts: jest.Mock;
let mockPrivateKeyFromString: jest.Mock;

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('@hiveio/dhive', () => {
    // Create the mock functions inside the factory
    mockGetAccounts = jest.fn();
    mockPrivateKeyFromString = jest.fn();

    const mockClient = {
        database: {
            getAccounts: mockGetAccounts,
        },
    };

    return {
        Client: jest.fn(() => mockClient),
        PrivateKey: {
            fromString: mockPrivateKeyFromString,
        },
    };
});

// Import service AFTER mocks are set up
import { accountStorageService as AccountStorageService } from '../services/AccountStorageService';

describe('AccountStorageService', () => {
    beforeEach(() => {
        // Clear all mocks but don't remove implementations
        mockGetAccounts.mockClear();
        mockPrivateKeyFromString.mockClear();
        (SecureStore.getItemAsync as jest.Mock).mockClear();
        (SecureStore.setItemAsync as jest.Mock).mockClear();
        (SecureStore.deleteItemAsync as jest.Mock).mockClear();

        // Mock SecureStore methods
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

        // Set up default dhive client mock behavior
        mockGetAccounts.mockResolvedValue([mockHiveAccount]);

        // Mock PrivateKey
        const mockPrivateKey = {
            createPublic: jest.fn().mockReturnValue({
                toString: jest.fn().mockReturnValue(mockPublicKey),
            }),
        };
        mockPrivateKeyFromString.mockReturnValue(mockPrivateKey);
    });

    describe('addAccount', () => {
        it('should add a new account with posting key only', async () => {
            await AccountStorageService.addAccount(mockUsername, mockPostingKey);

            // Verify posting key was stored
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                `account:${mockUsername}:postingKey`,
                mockPostingKey,
                expect.any(Object)
            );

            // Verify account list was updated
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_accounts_v3',
                expect.stringContaining(mockUsername),
                expect.any(Object)
            );
        });

        it('should add a new account with both posting and active keys', async () => {
            await AccountStorageService.addAccount(mockUsername, mockPostingKey, mockActiveKey);

            // Verify both keys were stored
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                `account:${mockUsername}:postingKey`,
                mockPostingKey,
                expect.any(Object)
            );
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                `account:${mockUsername}:activeKey`,
                mockActiveKey,
                expect.any(Object)
            );
        });

        it('should normalize username (remove @ and lowercase)', async () => {
            await AccountStorageService.addAccount('@TestUser', mockPostingKey);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'account:testuser:postingKey',
                mockPostingKey,
                expect.any(Object)
            );
        });

        it('should throw error if username is empty', async () => {
            await expect(
                AccountStorageService.addAccount('', mockPostingKey)
            ).rejects.toThrow('Username is required');
        });

        it('should throw error if posting key is empty', async () => {
            await expect(
                AccountStorageService.addAccount(mockUsername, '')
            ).rejects.toThrow('Posting key is required');
        });

        it('should throw error if account not found on blockchain', async () => {
            // Override the default mock to return empty array
            mockGetAccounts.mockResolvedValueOnce([]);

            await expect(
                AccountStorageService.addAccount(mockUsername, mockPostingKey)
            ).rejects.toThrow('not found on Hive blockchain');
        });

        it('should throw error if posting key is invalid', async () => {
            const wrongPublicKey = 'STM5WrongPublicKey';
            const mockPrivateKey = {
                createPublic: jest.fn().mockReturnValue({
                    toString: jest.fn().mockReturnValue(wrongPublicKey),
                }),
            };
            mockPrivateKeyFromString.mockReturnValue(mockPrivateKey);

            await expect(
                AccountStorageService.addAccount(mockUsername, mockPostingKey)
            ).rejects.toThrow('Invalid posting key');
        });
    });

    describe('getAccounts', () => {
        it('should return empty array if no accounts stored', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

            const accounts = await AccountStorageService.getAccounts();

            expect(accounts).toEqual([]);
        });

        it('should return sorted accounts (most recent first)', async () => {
            const mockAccounts = [
                { username: 'user1', hasActiveKey: false, avatar: '', lastUsed: 1000 },
                { username: 'user2', hasActiveKey: true, avatar: '', lastUsed: 3000 },
                { username: 'user3', hasActiveKey: false, avatar: '', lastUsed: 2000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            const accounts = await AccountStorageService.getAccounts();

            expect(accounts).toHaveLength(3);
            expect(accounts[0].username).toBe('user2'); // Most recent
            expect(accounts[1].username).toBe('user3');
            expect(accounts[2].username).toBe('user1');
        });

        it('should handle invalid JSON gracefully', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid json');

            const accounts = await AccountStorageService.getAccounts();

            expect(accounts).toEqual([]);
        });

        it('should filter out invalid account entries', async () => {
            const mockAccounts = [
                { username: 'valid', hasActiveKey: false, avatar: '', lastUsed: 1000 },
                { invalid: 'data' }, // Missing username
                null, // Null entry
                { username: 'valid2', hasActiveKey: true, avatar: '', lastUsed: 2000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            const accounts = await AccountStorageService.getAccounts();

            expect(accounts).toHaveLength(2);
            expect(accounts[0].username).toBe('valid2');
            expect(accounts[1].username).toBe('valid');
        });
    });

    describe('getAccount', () => {
        it('should return specific account by username', async () => {
            const mockAccounts = [
                { username: 'user1', hasActiveKey: false, avatar: '', lastUsed: 1000 },
                { username: 'user2', hasActiveKey: true, avatar: '', lastUsed: 2000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            const account = await AccountStorageService.getAccount('user2');

            expect(account).not.toBeNull();
            expect(account?.username).toBe('user2');
            expect(account?.hasActiveKey).toBe(true);
        });

        it('should return null if account not found', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('[]');

            const account = await AccountStorageService.getAccount('nonexistent');

            expect(account).toBeNull();
        });

        it('should handle username normalization when searching', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            const account = await AccountStorageService.getAccount('@TestUser');

            expect(account).not.toBeNull();
            expect(account?.username).toBe('testuser');
        });
    });

    describe('removeAccount', () => {
        it('should remove account and its keys', async () => {
            const mockAccounts = [
                { username: 'user1', hasActiveKey: false, avatar: '', lastUsed: 1000 },
                { username: 'user2', hasActiveKey: true, avatar: '', lastUsed: 2000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.removeAccount('user1');

            // Verify keys were deleted
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
                'account:user1:postingKey'
            );
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
                'account:user1:activeKey'
            );

            // Verify account list was updated (should only contain user2)
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_accounts_v3',
                expect.not.stringContaining('user1'),
                expect.any(Object)
            );
        });

        it('should remove storage key if no accounts left', async () => {
            const mockAccounts = [
                { username: 'onlyuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.removeAccount('onlyuser');

            // Verify storage key was deleted
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('hive_accounts_v3');
        });

        it('should clear current account if removed account was current', async () => {
            const mockAccounts = [
                { username: 'currentuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];

            (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
                if (key === 'hive_accounts_v3') return JSON.stringify(mockAccounts);
                if (key === 'hive_current_account') return 'currentuser';
                return null;
            });

            await AccountStorageService.removeAccount('currentuser');

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('hive_current_account');
        });
    });

    describe('getAccountKeys', () => {
        it('should return posting key only if no active key', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
                if (key === 'account:testuser:postingKey') return mockPostingKey;
                return null;
            });

            const keys = await AccountStorageService.getAccountKeys('testuser');

            expect(keys).not.toBeNull();
            expect(keys?.postingKey).toBe(mockPostingKey);
            expect(keys?.activeKey).toBeUndefined();
        });

        it('should return both keys if both stored', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
                if (key === 'account:testuser:postingKey') return mockPostingKey;
                if (key === 'account:testuser:activeKey') return mockActiveKey;
                return null;
            });

            const keys = await AccountStorageService.getAccountKeys('testuser');

            expect(keys).not.toBeNull();
            expect(keys?.postingKey).toBe(mockPostingKey);
            expect(keys?.activeKey).toBe(mockActiveKey);
        });

        it('should return null if account has no keys', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

            const keys = await AccountStorageService.getAccountKeys('nonexistent');

            expect(keys).toBeNull();
        });
    });

    describe('hasActiveKey', () => {
        it('should return true if active key exists', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockActiveKey);

            const hasKey = await AccountStorageService.hasActiveKey('testuser');

            expect(hasKey).toBe(true);
        });

        it('should return false if active key does not exist', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

            const hasKey = await AccountStorageService.hasActiveKey('testuser');

            expect(hasKey).toBe(false);
        });
    });

    describe('addActiveKey', () => {
        it('should add active key to existing account', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.addActiveKey('testuser', mockActiveKey);

            // Verify active key was stored
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'account:testuser:activeKey',
                mockActiveKey,
                expect.any(Object)
            );

            // Verify account metadata was updated
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_accounts_v3',
                expect.stringContaining('"hasActiveKey":true'),
                expect.any(Object)
            );
        });

        it('should throw error if account does not exist', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('[]');

            await expect(
                AccountStorageService.addActiveKey('nonexistent', mockActiveKey)
            ).rejects.toThrow('Account not found');
        });

        it('should throw error if active key is empty', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await expect(
                AccountStorageService.addActiveKey('testuser', '')
            ).rejects.toThrow('Active key is required');
        });
    });

    describe('removeActiveKey', () => {
        it('should remove active key and update metadata', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: true, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.removeActiveKey('testuser');

            // Verify active key was deleted
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
                'account:testuser:activeKey'
            );

            // Verify metadata was updated
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_accounts_v3',
                expect.stringContaining('"hasActiveKey":false'),
                expect.any(Object)
            );
        });
    });

    describe('getCurrentAccountUsername', () => {
        it('should return current account username', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('testuser');

            const username = await AccountStorageService.getCurrentAccountUsername();

            expect(username).toBe('testuser');
        });

        it('should return null if no current account', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

            const username = await AccountStorageService.getCurrentAccountUsername();

            expect(username).toBeNull();
        });
    });

    describe('setCurrentAccountUsername', () => {
        it('should set current account and update lastUsed', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.setCurrentAccountUsername('testuser');

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_current_account',
                'testuser',
                expect.any(Object)
            );
        });

        it('should throw error if account does not exist', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('[]');

            await expect(
                AccountStorageService.setCurrentAccountUsername('nonexistent')
            ).rejects.toThrow('Account not found');
        });
    });

    describe('clearCurrentAccountUsername', () => {
        it('should clear current account', async () => {
            await AccountStorageService.clearCurrentAccountUsername();

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('hive_current_account');
        });
    });

    describe('updateLastUsed', () => {
        it('should update lastUsed timestamp for account', async () => {
            const mockAccounts = [
                { username: 'testuser', hasActiveKey: false, avatar: '', lastUsed: 1000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.updateLastUsed('testuser');

            // Verify account list was updated with new timestamp
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'hive_accounts_v3',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    describe('clearAllAccounts', () => {
        it('should remove all accounts and keys', async () => {
            const mockAccounts = [
                { username: 'user1', hasActiveKey: false, avatar: '', lastUsed: 1000 },
                { username: 'user2', hasActiveKey: true, avatar: '', lastUsed: 2000 },
            ];
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockAccounts)
            );

            await AccountStorageService.clearAllAccounts();

            // Verify all keys were deleted
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('account:user1:postingKey');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('account:user1:activeKey');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('account:user2:postingKey');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('account:user2:activeKey');

            // Verify storage was cleared
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('hive_accounts_v3');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('hive_current_account');
        });
    });
});