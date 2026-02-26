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
import type { PublicKey } from '@hiveio/dhive';
import { getAvatarImageUrl } from './AvatarService';

// Storage keys
const ACCOUNTS_STORAGE_KEY = 'hive_accounts_v3';
const CURRENT_ACCOUNT_KEY = 'hive_current_account';

// SecureStore options for maximum security
const secureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Helper functions to generate storage keys
const postingKeyStorageKey = (username: string) =>
    `account:${username}:postingKey`;
const activeKeyStorageKey = (username: string) =>
    `account:${username}:activeKey`;

// Hive API nodes for key validation
const HIVE_NODES = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://api.openhive.network',
];

// Hive username validation regex: 3-16 characters, starts with letter, ends with letter/number, allows dots and hyphens
const HIVE_USERNAME_REGEX = /^[a-z][a-z0-9\-.]{1,14}[a-z0-9]$/;

// Maximum number of accounts that can be stored
const MAX_ACCOUNTS = 10;

/**
 * Type for Hive key authority tuples
 * Key can be either a string (public key) or a PublicKey object
 */
type KeyAuthority = [string | PublicKey, number];

/**
 * Stored account metadata (no private keys)
 * Note: Avatar URLs are computed on read, not stored
 */
export interface StoredAccount {
    username: string;
    hasActiveKey: boolean;
    avatar: string; // Computed dynamically, not persisted
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
 * 
 * Thread-safe account list modifications are protected by an internal mutex.
 * All methods that modify the account list serialize their operations.
 */
class AccountStorageServiceImpl {
    private client: Client;
    private modificationQueue: Promise<void> = Promise.resolve();

    constructor() {
        this.client = new Client(HIVE_NODES);
    }

    /**
     * Serialize account list modifications to prevent race conditions
     * @private
     */
    private async withModificationLock<T>(
        operation: () => Promise<T>
    ): Promise<T> {
        const previousOperation = this.modificationQueue;
        let resolveCurrentOperation: () => void;

        this.modificationQueue = new Promise<void>(resolve => {
            resolveCurrentOperation = resolve;
        });

        try {
            await previousOperation;
            return await operation();
        } finally {
            resolveCurrentOperation!();
        }
    }

    /**
     * Migrate from legacy storage format (v1) to v3
     * Legacy format: hive_username, hive_posting_key
     * New format: hive_accounts_v3 with per-account keys
     * @private
     */
    private async migrateFromLegacyStorage(): Promise<void> {
        try {
            // Check if legacy storage exists
            const legacyUsername = await SecureStore.getItemAsync('hive_username');
            const legacyPostingKey = await SecureStore.getItemAsync(
                'hive_posting_key'
            );

            if (!legacyUsername || !legacyPostingKey) {
                return; // No legacy data to migrate
            }

            console.log(
                '[AccountStorageService] Migrating legacy account:',
                legacyUsername
            );

            // Normalize username
            const normalizedUsername = this.normalizeUsername(legacyUsername);

            // Check if already migrated
            const accountsJson = await SecureStore.getItemAsync(
                ACCOUNTS_STORAGE_KEY
            );
            if (accountsJson) {
                const accounts = JSON.parse(accountsJson);
                const alreadyMigrated = accounts.some(
                    (acc: any) => acc.username === normalizedUsername
                );
                if (alreadyMigrated) {
                    console.log(
                        '[AccountStorageService] Account already migrated, cleaning up legacy keys'
                    );
                    await SecureStore.deleteItemAsync('hive_username');
                    await SecureStore.deleteItemAsync('hive_posting_key');
                    return;
                }
            }

            // Store posting key in new format
            await SecureStore.setItemAsync(
                postingKeyStorageKey(normalizedUsername),
                legacyPostingKey,
                secureStoreOptions
            );

            // Create account metadata (without avatar - computed on read)
            const accountData = {
                username: normalizedUsername,
                hasActiveKey: false,
                lastUsed: Date.now(),
            };

            // Add to accounts list
            const accounts = accountsJson ? JSON.parse(accountsJson) : [];
            accounts.push(accountData);
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(accounts),
                secureStoreOptions
            );

            // Set as current account
            await SecureStore.setItemAsync(
                CURRENT_ACCOUNT_KEY,
                normalizedUsername,
                secureStoreOptions
            );

            // Clean up legacy keys
            await SecureStore.deleteItemAsync('hive_username');
            await SecureStore.deleteItemAsync('hive_posting_key');

            console.log(
                '[AccountStorageService] Successfully migrated legacy account'
            );
        } catch (error) {
            console.error(
                '[AccountStorageService] Migration failed:',
                error
            );
            // Don't throw - allow app to continue even if migration fails
        }
    }

    /**
     * Normalize a Hive username: remove @, convert to lowercase, trim whitespace
     * @private
     */
    private normalizeUsername(username: string): string {
        return username.trim().replace(/^@/, '').toLowerCase();
    }

    /**
     * Strip avatar field from accounts before persisting to storage
     * Avatar URLs are computed dynamically on read, not stored
     * @private
     */
    private stripAvatarForStorage(
        accounts: StoredAccount[]
    ): Array<Omit<StoredAccount, 'avatar'>> {
        return accounts.map(({ avatar, ...rest }) => rest);
    }

    /**
     * Validate Hive username format
     * @private
     * @throws Error if username is invalid
     */
    private validateUsername(username: string): void {
        if (!username) {
            throw new Error('Username is required');
        }
        if (!HIVE_USERNAME_REGEX.test(username)) {
            throw new Error(
                'Invalid username format. Must be 3-16 characters: start with a letter, end with letter/number, lowercase letters, numbers, dots, and hyphens allowed'
            );
        }
    }

    /**
     * Add or update an account with its keys.
     *
     * Both the posting and active keys (if provided) are validated against the
     * blockchain before any new key data is written to storage. If validation
     * fails for either key, this method throws and does not modify any
     * previously stored keys or account metadata.
     *
     * Storage operations to SecureStore (posting key, active key, and account
     * metadata) are performed as separate writes and are not transactional.
     * If a SecureStore write fails after a previous write has succeeded, some
     * partial state (for example, a stored posting key without updated
     * metadata or active key) may remain.
     *
     * When updating an existing account: if the activeKey parameter is not provided
     * (undefined), any previously stored active key will be removed.
     *
     * @param username - Hive username (without @)
     * @param postingKey - Private posting key (required)
     * @param activeKey - Private active key (optional)
     * @throws Error if validation fails or a storage error occurs
     */
    async addAccount(
        username: string,
        postingKey: string,
        activeKey?: string
    ): Promise<void> {
        const normalizedUsername = this.normalizeUsername(username);
        this.validateUsername(normalizedUsername);

        if (!postingKey || !postingKey.trim()) {
            throw new Error('Posting key is required');
        }

        // Validate keys against blockchain before making any changes
        await this.validateKeys(normalizedUsername, postingKey, activeKey);

        // Store posting key in SecureStore
        await SecureStore.setItemAsync(
            postingKeyStorageKey(normalizedUsername),
            postingKey.trim(),
            secureStoreOptions
        );

        // Determine if this is an update to an existing account
        const accounts = await this.getAccounts();
        const existingIndex = accounts.findIndex(
            acc => acc.username === normalizedUsername
        );

        // Check maximum account limit for new accounts
        if (existingIndex < 0 && accounts.length >= MAX_ACCOUNTS) {
            throw new Error(
                `Maximum account limit (${MAX_ACCOUNTS}) reached. Remove an account before adding a new one.`
            );
        }

        // Handle active key: store if provided, remove if not (for updates)
        if (activeKey && activeKey.trim()) {
            await SecureStore.setItemAsync(
                activeKeyStorageKey(normalizedUsername),
                activeKey.trim(),
                secureStoreOptions
            );
        } else if (existingIndex >= 0) {
            // Remove active key if not provided (cleanup for updates only)
            await SecureStore.deleteItemAsync(
                activeKeyStorageKey(normalizedUsername)
            );
        }

        // Update account metadata (without avatar - computed on read)
        const accountDataForStorage = {
            username: normalizedUsername,
            hasActiveKey: !!(activeKey && activeKey.trim()),
            lastUsed: Date.now(),
        };

        // Get current accounts list for storage (without avatar field)
        const storedAccountsJson = await SecureStore.getItemAsync(
            ACCOUNTS_STORAGE_KEY
        );
        const storedAccounts = storedAccountsJson
            ? JSON.parse(storedAccountsJson)
            : [];

        const storedIndex = storedAccounts.findIndex(
            (acc: any) => acc.username === normalizedUsername
        );

        if (storedIndex >= 0) {
            // Update existing account
            storedAccounts[storedIndex] = accountDataForStorage;
        } else {
            // Add new account
            storedAccounts.push(accountDataForStorage);
        }

        // Save updated account list (avatar will be computed dynamically on read)
        await SecureStore.setItemAsync(
            ACCOUNTS_STORAGE_KEY,
            JSON.stringify(storedAccounts),
            secureStoreOptions
        );
    }

    /**
     * Get all stored accounts (metadata only, no keys)
     * Returns empty array if no accounts found
     * Automatically migrates from legacy storage format if detected
     */
    async getAccounts(): Promise<StoredAccount[]> {
        try {
            // Attempt migration from legacy format
            await this.migrateFromLegacyStorage();

            const accountsJson = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);

            if (!accountsJson) {
                return [];
            }

            const parsed = JSON.parse(accountsJson);

            if (!Array.isArray(parsed)) {
                console.warn(
                    '[AccountStorageService] Invalid accounts format, resetting'
                );
                return [];
            }

            // Validate and normalize each account
            const accountPromises = parsed
                .filter(acc => {
                    if (!acc || typeof acc.username !== 'string') {
                        return false;
                    }
                    const normalized = this.normalizeUsername(acc.username);
                    // Only keep accounts with a valid username format
                    return HIVE_USERNAME_REGEX.test(normalized);
                })
                .map(async acc => {
                    const normalizedUsername = this.normalizeUsername(acc.username);

                    // Reconcile hasActiveKey from SecureStore (source of truth)
                    const activeKey = await SecureStore.getItemAsync(
                        activeKeyStorageKey(normalizedUsername)
                    );

                    return {
                        username: normalizedUsername,
                        hasActiveKey: !!activeKey, // Always from SecureStore, not metadata
                        avatar: getAvatarImageUrl(normalizedUsername), // Always computed dynamically
                        lastUsed:
                            typeof acc.lastUsed === 'number' ? acc.lastUsed : Date.now(),
                    };
                });

            // Resolve all promises (hasActiveKey checks)
            const resolvedAccounts = await Promise.all(accountPromises);
            return resolvedAccounts.sort((a, b) => b.lastUsed - a.lastUsed); // Most recent first
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
        const normalizedUsername = this.normalizeUsername(username);
        const accounts = await this.getAccounts();
        return accounts.find(acc => acc.username === normalizedUsername) || null;
    }

    /**
     * Remove an account and all its associated keys
     * Thread-safe: uses modification lock
     *
     * @param username - Hive username to remove
     */
    async removeAccount(username: string): Promise<void> {
        return this.withModificationLock(async () => {
            const normalizedUsername = this.normalizeUsername(username);

            // Remove keys from SecureStore
            await SecureStore.deleteItemAsync(postingKeyStorageKey(normalizedUsername));
            await SecureStore.deleteItemAsync(activeKeyStorageKey(normalizedUsername));

            // Remove from account list
            const accounts = await this.getAccounts();
            const filteredAccounts = accounts.filter(
                acc => acc.username !== normalizedUsername
            );

            if (filteredAccounts.length > 0) {
                // Save without avatar field
                await SecureStore.setItemAsync(
                    ACCOUNTS_STORAGE_KEY,
                    JSON.stringify(this.stripAvatarForStorage(filteredAccounts)),
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
        });
    }

    /**
     * Get the keys for a specific account
     *
     * @param username - Hive username
     * @returns Account keys or null if not found
     */
    async getAccountKeys(username: string): Promise<AccountKeys | null> {
        const normalizedUsername = this.normalizeUsername(username);

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
        const normalizedUsername = this.normalizeUsername(username);
        const activeKey = await SecureStore.getItemAsync(
            activeKeyStorageKey(normalizedUsername)
        );
        return !!activeKey;
    }

    /**
     * Add or update active key for an existing account
     * Validates the key before storing
     * Thread-safe: uses modification lock
     *
     * @param username - Hive username
     * @param activeKey - Private active key
     */
    async addActiveKey(username: string, activeKey: string): Promise<void> {
        return this.withModificationLock(async () => {
            const normalizedUsername = this.normalizeUsername(username);

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
                acc => acc.username === normalizedUsername
            );

            if (accountIndex >= 0) {
                accounts[accountIndex].hasActiveKey = true;
                // Save without avatar field
                await SecureStore.setItemAsync(
                    ACCOUNTS_STORAGE_KEY,
                    JSON.stringify(this.stripAvatarForStorage(accounts)),
                    secureStoreOptions
                );
            }
        });
    }

    /**
     * Remove active key from an account (keeps posting key)
     * Thread-safe: uses modification lock
     *
     * @param username - Hive username
     */
    async removeActiveKey(username: string): Promise<void> {
        return this.withModificationLock(async () => {
            const normalizedUsername = this.normalizeUsername(username);

            // Remove active key from SecureStore
            await SecureStore.deleteItemAsync(activeKeyStorageKey(normalizedUsername));

            // Update account metadata
            const accounts = await this.getAccounts();
            const accountIndex = accounts.findIndex(
                acc => acc.username === normalizedUsername
            );

            if (accountIndex >= 0) {
                accounts[accountIndex].hasActiveKey = false;
                // Save without avatar field
                await SecureStore.setItemAsync(
                    ACCOUNTS_STORAGE_KEY,
                    JSON.stringify(this.stripAvatarForStorage(accounts)),
                    secureStoreOptions
                );
            }
        });
    }

    /**
     * Get the current active account username
     * Returns null if no current account is set
     */
    async getCurrentAccountUsername(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(CURRENT_ACCOUNT_KEY);
        } catch (error) {
            console.error(
                '[AccountStorageService] Error reading current account:',
                error
            );
            return null;
        }
    }

    /**
     * Set the current active account
     * Updates the lastUsed timestamp
     * Thread-safe: uses modification lock
     *
     * @param username - Hive username to set as current
     */
    async setCurrentAccountUsername(username: string): Promise<void> {
        return this.withModificationLock(async () => {
            const normalizedUsername = this.normalizeUsername(username);

            // Get accounts list (single read for both verification and update)
            const accounts = await this.getAccounts();
            const accountIndex = accounts.findIndex(
                acc => acc.username === normalizedUsername
            );

            if (accountIndex < 0) {
                throw new Error('Account not found');
            }

            await SecureStore.setItemAsync(
                CURRENT_ACCOUNT_KEY,
                normalizedUsername,
                secureStoreOptions
            );

            // Update lastUsed timestamp in-place
            accounts[accountIndex].lastUsed = Date.now();
            // Save without avatar field
            await SecureStore.setItemAsync(
                ACCOUNTS_STORAGE_KEY,
                JSON.stringify(this.stripAvatarForStorage(accounts)),
                secureStoreOptions
            );
        });
    }

    /**
     * Clear the current account (logout)
     */
    async clearCurrentAccountUsername(): Promise<void> {
        await SecureStore.deleteItemAsync(CURRENT_ACCOUNT_KEY);
    }

    /**
     * Update the lastUsed timestamp for an account
     * Thread-safe: uses modification lock
     *
     * @param username - Hive username
     */
    async updateLastUsed(username: string): Promise<void> {
        return this.withModificationLock(async () => {
            const normalizedUsername = this.normalizeUsername(username);
            const accounts = await this.getAccounts();
            const accountIndex = accounts.findIndex(
                acc => acc.username === normalizedUsername
            );

            if (accountIndex >= 0) {
                accounts[accountIndex].lastUsed = Date.now();
                // Save without avatar field
                await SecureStore.setItemAsync(
                    ACCOUNTS_STORAGE_KEY,
                    JSON.stringify(this.stripAvatarForStorage(accounts)),
                    secureStoreOptions
                );
            }
        });
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
            const postingPublicKey = PrivateKey.fromString(postingKey)
                .createPublic()
                .toString();
            const hasPostingAuth = account.posting.key_auths.some(
                ([key]: KeyAuthority) => {
                    const keyStr = typeof key === 'string' ? key : String(key);
                    return keyStr === postingPublicKey;
                }
            );

            if (!hasPostingAuth) {
                throw new Error('Invalid posting key for this account');
            }

            // Validate active key if provided (pass already-fetched account)
            if (activeKey && activeKey.trim()) {
                await this.validateActiveKey(username, activeKey, account);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (
                    error.message.includes('Invalid posting key') ||
                    error.message.includes('Invalid active key') ||
                    error.message.includes('not found')
                ) {
                    throw error;
                }
                throw new Error(`Failed to validate keys: ${error.message}`);
            }
            throw new Error('Failed to validate keys: Unknown error');
        }
    }

    /**
     * Validate active key against Hive blockchain
     *
     * @private
     * @param username - Hive username
     * @param activeKey - Private active key
     * @param account - Optional pre-fetched account object (avoids redundant API call)
     * @throws Error if validation fails
     */
    private async validateActiveKey(
        username: string,
        activeKey: string,
        account?: any
    ): Promise<void> {
        try {
            // Use provided account or fetch from blockchain
            if (!account) {
                const accounts = await this.client.database.getAccounts([username]);

                if (!accounts || accounts.length === 0) {
                    throw new Error(`Account @${username} not found on Hive blockchain`);
                }

                account = accounts[0];
            }

            const activePublicKey = PrivateKey.fromString(activeKey)
                .createPublic()
                .toString();
            const hasActiveAuth = account.active.key_auths.some(
                ([key]: KeyAuthority) => {
                    const keyStr = typeof key === 'string' ? key : String(key);
                    return keyStr === activePublicKey;
                }
            );

            if (!hasActiveAuth) {
                throw new Error('Invalid active key for this account');
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (
                    error.message.includes('Invalid active key') ||
                    error.message.includes('not found')
                ) {
                    throw error;
                }
                throw new Error(`Failed to validate active key: ${error.message}`);
            }
            throw new Error('Failed to validate active key: Unknown error');
        }
    }

    /**
     * Clear all stored accounts and keys
     * USE WITH CAUTION - This removes all data
     * Thread-safe: uses modification lock
     */
    async clearAllAccounts(): Promise<void> {
        return this.withModificationLock(async () => {
            const accounts = await this.getAccounts();

            // Remove all account keys in parallel for efficiency
            const deletionPromises = accounts.flatMap(account => [
                SecureStore.deleteItemAsync(postingKeyStorageKey(account.username)),
                SecureStore.deleteItemAsync(activeKeyStorageKey(account.username)),
            ]);

            await Promise.all(deletionPromises);

            // Remove account list and current account
            await Promise.all([
                SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY),
                SecureStore.deleteItemAsync(CURRENT_ACCOUNT_KEY),
            ]);
        });
    }
}

// Export singleton instance
export const accountStorageService = new AccountStorageServiceImpl();
