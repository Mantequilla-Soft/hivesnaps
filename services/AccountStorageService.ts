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
import { PrivateKey, Client, PublicKey } from '@hiveio/dhive';
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

// Hive username validation regex: 3-16 characters, lowercase letters, numbers, hyphens
const HIVE_USERNAME_REGEX = /^[a-z0-9-]{3,16}$/;

/**
 * Type for Hive key authority tuples
 * Key can be either a string (public key) or a PublicKey object
 */
type KeyAuthority = [string | PublicKey, number];

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
 *
 * CONCURRENCY WARNING:
 * This service is NOT thread-safe. Methods that modify the account list
 * (removeAccount, addActiveKey, removeActiveKey, updateLastUsed) use a
 * read-modify-write pattern on the account list. Concurrent calls to these
 * methods may result in lost updates. The application should ensure that
 * only one account modification operation is in progress at a time.
 */
class AccountStorageServiceImpl {
  private client: Client;

  constructor() {
    this.client = new Client(HIVE_NODES);
  }

  /**
   * Normalize a Hive username: remove @, convert to lowercase, trim whitespace
   * @private
   */
  private normalizeUsername(username: string): string {
    return username.trim().replace(/^@/, '').toLowerCase();
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
        'Invalid username format. Must be 3-16 characters: lowercase letters, numbers, hyphens only'
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

    // Handle active key: store if provided, remove if not
    if (activeKey && activeKey.trim()) {
      await SecureStore.setItemAsync(
        activeKeyStorageKey(normalizedUsername),
        activeKey.trim(),
        secureStoreOptions
      );
    } else {
      // Remove active key if not provided (cleanup for updates)
      await SecureStore.deleteItemAsync(
        activeKeyStorageKey(normalizedUsername)
      );
    }

    // Update account metadata
    const accounts = await this.getAccounts();
    const existingIndex = accounts.findIndex(
      acc => acc.username === normalizedUsername
    );

    const accountData: StoredAccount = {
      username: normalizedUsername,
      hasActiveKey: !!(activeKey && activeKey.trim()),
      avatar: getAvatarImageUrl(normalizedUsername),
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
        console.warn(
          '[AccountStorageService] Invalid accounts format, resetting'
        );
        return [];
      }

      // Validate and normalize each account
      return parsed
        .filter(acc => {
          if (!acc || typeof acc.username !== 'string') {
            return false;
          }
          const normalized = this.normalizeUsername(acc.username);
          // Only keep accounts with a valid username format
          return HIVE_USERNAME_REGEX.test(normalized);
        })
        .map(acc => {
          const normalizedUsername = this.normalizeUsername(acc.username);

          return {
            username: normalizedUsername,
            hasActiveKey: !!acc.hasActiveKey,
            avatar:
              typeof acc.avatar === 'string'
                ? acc.avatar
                : getAvatarImageUrl(normalizedUsername),
            lastUsed:
              typeof acc.lastUsed === 'number' ? acc.lastUsed : Date.now(),
          };
        })
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
    const normalizedUsername = this.normalizeUsername(username);
    const accounts = await this.getAccounts();
    return accounts.find(acc => acc.username === normalizedUsername) || null;
  }

  /**
   * Remove an account and all its associated keys
   *
   * WARNING: Not safe for concurrent calls. Uses read-modify-write on account list.
   *
   * @param username - Hive username to remove
   */
  async removeAccount(username: string): Promise<void> {
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
   *
   * WARNING: Not safe for concurrent calls. Uses read-modify-write on account list.
   *
   * @param username - Hive username
   * @param activeKey - Private active key
   */
  async addActiveKey(username: string, activeKey: string): Promise<void> {
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
   * WARNING: Not safe for concurrent calls. Uses read-modify-write on account list.
   *
   * @param username - Hive username
   */
  async removeActiveKey(username: string): Promise<void> {
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
   *
   * @param username - Hive username to set as current
   */
  async setCurrentAccountUsername(username: string): Promise<void> {
    const normalizedUsername = this.normalizeUsername(username);

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
   * WARNING: Not safe for concurrent calls. Uses read-modify-write on account list.
   *
   * @param username - Hive username
   */
  async updateLastUsed(username: string): Promise<void> {
    const normalizedUsername = this.normalizeUsername(username);
    const accounts = await this.getAccounts();
    const accountIndex = accounts.findIndex(
      acc => acc.username === normalizedUsername
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

      // Validate active key if provided
      if (activeKey && activeKey.trim()) {
        await this.validateActiveKey(username, activeKey);
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
   * @throws Error if validation fails
   */
  private async validateActiveKey(
    username: string,
    activeKey: string
  ): Promise<void> {
    try {
      const accounts = await this.client.database.getAccounts([username]);

      if (!accounts || accounts.length === 0) {
        throw new Error(`Account @${username} not found on Hive blockchain`);
      }

      const account = accounts[0];

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
export const accountStorageService = new AccountStorageServiceImpl();
