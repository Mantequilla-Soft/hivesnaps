/**
 * Multi-Account Storage Service
 * 
 * Manages secure storage of multiple Hive accounts with separate posting and active keys.
 * Keys are stored in OS-protected SecureStore with device-level encryption.
 * 
 * Storage Structure:
 * - Account list: 'hive_accounts_v3' (JSON array of account metadata)
 * - Posting key: 'account:{username}:postingKey' (encrypted string)
 * - Active key: 'account:{username}:activeKey' (encrypted string, optional)
 * - Current account: 'hive_current_account' (username string)
 */

import * as SecureStore from 'expo-secure-store';
import { PrivateKey, Client } from '@hiveio/dhive';

// Storage keys
const ACCOUNTS_STORAGE_KEY = 'hive_accounts_v3';
const CURRENT_ACCOUNT_KEY = 'hive_current_account';

// SecureStore options for maximum security
const secureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Helper functions to generate storage keys
const postingKeyStorageKey = (username: string) => `account:${username}:postingKey`;
const activeKeyStorageKey = (username: string) => `account:${username}:activeKey`;

// Hive API nodes for key validation
const HIVE_NODES = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://api.openhive.network',
];

/**
 * Stored account metadata (no private keys)
 */
export interface StoredAccount {
    username: string;
    hasActiveKey: boolean;
    avatar: string;
    lastUsed: number;
}

/**
 * Account keys (returned when retrieving keys)
 */
export interface AccountKeys {
    postingKey: string;
    activeKey?: string;
}

/**
 * Account Storage Service Implementation
 */
class AccountStorageServiceImpl {
    private client: Client;

    constructor() {
        this.client = new Client(HIVE_NODES);
    }

    /**
     * Add or update an account with its keys
     * Validates keys against the blockchain before storing
     * 
     * @param username - Hive username (without @)
     * @param postingKey - Private posting key (required)
     * @param activeKey - Private active key (optional)
     * @throws Error if validation fails
     */
    async addAccount(
        username: string,
        postingKey: string,
        activeKey?: string
    ): Promise<void> {
        // Normalize username (remove @ if present, lowercase)
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        if (!normalizedUsername) {
            throw new Error('Username is required');
        }

        if (!postingKey || !postingKey.trim()) {
            throw new Error('Posting key is required');
        }

        // Validate keys against blockchain
        await this.validateKeys(normalizedUsername, postingKey, activeKey);

        // Store keys in SecureStore
        await SecureStore.setItemAsync(
            postingKeyStorageKey(normalizedUsername),
            postingKey.trim(),
            secureStoreOptions
        );

        if (activeKey && activeKey.trim()) {
            await SecureStore.setItemAsync(
                activeKeyStorageKey(normalizedUsername),
                activeKey.trim(),
                secureStoreOptions
            );
        }

        // Update account metadata
        const accounts = await this.getAccounts();
        const existingIndex = accounts.findIndex(
            (acc) => acc.username === normalizedUsername
        );

        const accountData: StoredAccount = {
            username: normalizedUsername,
            hasActiveKey: !!(activeKey && activeKey.trim()),
            avatar: `https://images.ecency.com/u/${normalizedUsername}/avatar`,
            lastUsed: Date.now(),
        };

        if (existingIndex >= 0) {
            // Update existing account
            accounts[existingIndex] = accountData;
        } else {
            // Add new account
            accounts.push(accountData);
        }

        // Save updated account list
        await SecureStore.setItemAsync(
            ACCOUNTS_STORAGE_KEY,
            JSON.stringify(accounts),
            secureStoreOptions
        );
    }

    /**
     * Get all stored accounts (metadata only, no keys)
     * Returns empty array if no accounts found
     */
    async getAccounts(): Promise<StoredAccount[]> {
        try {
            const accountsJson = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);

            if (!accountsJson) {
                return [];
            }

            const parsed = JSON.parse(accountsJson);

            if (!Array.isArray(parsed)) {
                console.warn('[AccountStorageService] Invalid accounts format, resetting');
                return [];
            }

            // Validate and normalize each account
            return parsed
                .filter((acc) => acc && typeof acc.username === 'string')
                .map((acc) => ({
                    username: acc.username,
                    hasActiveKey: !!acc.hasActiveKey,
                    avatar: typeof acc.avatar === 'string'
                        ? acc.avatar
                        : `https://images.ecency.com/u/${acc.username}/avatar`,
                    lastUsed: typeof acc.lastUsed === 'number' ? acc.lastUsed : Date.now(),
                }))
                .sort((a, b) => b.lastUsed - a.lastUsed); // Most recent first
        } catch (error) {
            console.error('[AccountStorageService] Error reading accounts:', error);
            return [];
        }
    }

    /**
     * Get a specific account by username
     * Returns null if account not found
     */
    async getAccount(username: string): Promise<StoredAccount | null> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();
        const accounts = await this.getAccounts();
        return accounts.find((acc) => acc.username === normalizedUsername) || null;
    }

    /**
     * Remove an account and all its associated keys
     * 
     * @param username - Hive username to remove
     */
    async removeAccount(username: string): Promise<void> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        // Remove keys from SecureStore
        await SecureStore.deleteItemAsync(postingKeyStorageKey(normalizedUsername));
        await SecureStore.deleteItemAsync(activeKeyStorageKey(normalizedUsername));

        // Remove from account list
        const accounts = await this.getAccounts();
        const filteredAccounts = accounts.filter(
            (acc) => acc.username !== normalizedUsername
        );

        if (filteredAccounts.length > 0) {
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(filteredAccounts),
                secureStoreOptions
            );
        } else {
            // No accounts left, remove the storage key
            await SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY);
        }

        // Clear current account if it was the removed account
        const currentAccount = await this.getCurrentAccountUsername();
        if (currentAccount === normalizedUsername) {
            await this.clearCurrentAccountUsername();
        }
    }

    /**
     * Get the keys for a specific account
     * 
     * @param username - Hive username
     * @returns Account keys or null if not found
     */
    async getAccountKeys(username: string): Promise<AccountKeys | null> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        const postingKey = await SecureStore.getItemAsync(
            postingKeyStorageKey(normalizedUsername)
        );

        if (!postingKey) {
            return null;
        }

        const activeKey = await SecureStore.getItemAsync(
            activeKeyStorageKey(normalizedUsername)
        );

        return {
            postingKey,
            activeKey: activeKey || undefined,
        };
    }

    /**
     * Check if an account has an active key stored
     * 
     * @param username - Hive username
     * @returns true if active key exists
     */
    async hasActiveKey(username: string): Promise<boolean> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();
        const activeKey = await SecureStore.getItemAsync(
            activeKeyStorageKey(normalizedUsername)
        );
        return !!activeKey;
    }

    /**
     * Add or update active key for an existing account
     * Validates the key before storing
     * 
     * @param username - Hive username
     * @param activeKey - Private active key
     */
    async addActiveKey(username: string, activeKey: string): Promise<void> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        if (!activeKey || !activeKey.trim()) {
            throw new Error('Active key is required');
        }

        // Verify account exists
        const account = await this.getAccount(normalizedUsername);
        if (!account) {
            throw new Error('Account not found');
        }

        // Validate active key against blockchain
        await this.validateActiveKey(normalizedUsername, activeKey);

        // Store active key
        await SecureStore.setItemAsync(
            activeKeyStorageKey(normalizedUsername),
            activeKey.trim(),
            secureStoreOptions
        );

        // Update account metadata
        const accounts = await this.getAccounts();
        const accountIndex = accounts.findIndex(
            (acc) => acc.username === normalizedUsername
        );

        if (accountIndex >= 0) {
            accounts[accountIndex].hasActiveKey = true;
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(accounts),
                secureStoreOptions
            );
        }
    }

    /**
     * Remove active key from an account (keeps posting key)
     * 
     * @param username - Hive username
     */
    async removeActiveKey(username: string): Promise<void> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        // Remove active key from SecureStore
        await SecureStore.deleteItemAsync(activeKeyStorageKey(normalizedUsername));

        // Update account metadata
        const accounts = await this.getAccounts();
        const accountIndex = accounts.findIndex(
            (acc) => acc.username === normalizedUsername
        );

        if (accountIndex >= 0) {
            accounts[accountIndex].hasActiveKey = false;
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(accounts),
                secureStoreOptions
            );
        }
    }

    /**
     * Get the current active account username
     * Returns null if no current account is set
     */
    async getCurrentAccountUsername(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(CURRENT_ACCOUNT_KEY);
        } catch (error) {
            console.error('[AccountStorageService] Error reading current account:', error);
            return null;
        }
    }

    /**
     * Set the current active account
     * Updates the lastUsed timestamp
     * 
     * @param username - Hive username to set as current
     */
    async setCurrentAccountUsername(username: string): Promise<void> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();

        // Verify account exists
        const account = await this.getAccount(normalizedUsername);
        if (!account) {
            throw new Error('Account not found');
        }

        await SecureStore.setItemAsync(
            CURRENT_ACCOUNT_KEY,
            normalizedUsername,
            secureStoreOptions
        );

        await this.updateLastUsed(normalizedUsername);
    }

    /**
     * Clear the current account (logout)
     */
    async clearCurrentAccountUsername(): Promise<void> {
        await SecureStore.deleteItemAsync(CURRENT_ACCOUNT_KEY);
    }

    /**
     * Update the lastUsed timestamp for an account
     * 
     * @param username - Hive username
     */
    async updateLastUsed(username: string): Promise<void> {
        const normalizedUsername = username.replace('@', '').toLowerCase().trim();
        const accounts = await this.getAccounts();
        const accountIndex = accounts.findIndex(
            (acc) => acc.username === normalizedUsername
        );

        if (accountIndex >= 0) {
            accounts[accountIndex].lastUsed = Date.now();
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(accounts),
                secureStoreOptions
            );
        }
    }

    /**
     * Validate posting key and optional active key against Hive blockchain
     * 
     * @private
     * @param username - Hive username
     * @param postingKey - Private posting key
     * @param activeKey - Private active key (optional)
     * @throws Error if validation fails
     */
    private async validateKeys(
        username: string,
        postingKey: string,
        activeKey?: string
    ): Promise<void> {
        try {
            // Get account data from blockchain
            const accounts = await this.client.database.getAccounts([username]);

            if (!accounts || accounts.length === 0) {
                throw new Error(`Account @${username} not found on Hive blockchain`);
            }

            const account = accounts[0];

            // Validate posting key
            const postingPublicKey = PrivateKey.fromString(postingKey).createPublic().toString();
            const hasPostingAuth = account.posting.key_auths.some(
                ([key]: [string | any, number]) => {
                    const keyStr = typeof key === 'string' ? key : key.toString();
                    return keyStr === postingPublicKey;
                }
            );

            if (!hasPostingAuth) {
                throw new Error('Invalid posting key for this account');
            }

            // Validate active key if provided
            if (activeKey && activeKey.trim()) {
                await this.validateActiveKey(username, activeKey);
            }
        } catch (error: any) {
            if (error.message.includes('Invalid posting key') ||
                error.message.includes('Invalid active key') ||
                error.message.includes('not found')) {
                throw error;
            }
            throw new Error(`Failed to validate keys: ${error.message}`);
        }
    }

    /**
     * Validate active key against Hive blockchain
     * 
     * @private
     * @param username - Hive username
     * @param activeKey - Private active key
     * @throws Error if validation fails
     */
    private async validateActiveKey(username: string, activeKey: string): Promise<void> {
        try {
            const accounts = await this.client.database.getAccounts([username]);

            if (!accounts || accounts.length === 0) {
                throw new Error(`Account @${username} not found on Hive blockchain`);
            }

            const account = accounts[0];

            const activePublicKey = PrivateKey.fromString(activeKey).createPublic().toString();
            const hasActiveAuth = account.active.key_auths.some(
                ([key]: [string | any, number]) => {
                    const keyStr = typeof key === 'string' ? key : key.toString();
                    return keyStr === activePublicKey;
                }
            );

            if (!hasActiveAuth) {
                throw new Error('Invalid active key for this account');
            }
        } catch (error: any) {
            if (error.message.includes('Invalid active key') ||
                error.message.includes('not found')) {
                throw error;
            }
            throw new Error(`Failed to validate active key: ${error.message}`);
        }
    }

    /**
     * Clear all stored accounts and keys
     * USE WITH CAUTION - This removes all data
     */
    async clearAllAccounts(): Promise<void> {
        const accounts = await this.getAccounts();

        // Remove all account keys
        for (const account of accounts) {
            await SecureStore.deleteItemAsync(postingKeyStorageKey(account.username));
            await SecureStore.deleteItemAsync(activeKeyStorageKey(account.username));
        }

        // Remove account list and current account
        await SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY);
        await SecureStore.deleteItemAsync(CURRENT_ACCOUNT_KEY);
    }
}

// Export singleton instance
export const AccountStorageService = new AccountStorageServiceImpl();
