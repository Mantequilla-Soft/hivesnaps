/**
 * Multi-Account Storage Service
 * Manages encrypted storage of multiple Hive accounts with PIN protection
 */

import * as SecureStore from 'expo-secure-store';
import { PrivateKey, Client } from '@hiveio/dhive';
import { encryptWithPin, decryptWithPin } from '../utils/pinEncryption';

const ACCOUNTS_STORAGE_KEY = 'hive_accounts_v2';

// Hive nodes for validation
const HIVE_NODES = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://api.openhive.network',
];

export interface StoredAccount {
    username: string;
    encryptedPostingKey: string;
    postingSalt: string;
    postingIv: string;
    encryptedActiveKey?: string;
    activeSalt?: string;
    activeIv?: string;
    avatar: string;
    lastUsed: number;
}

export interface DecryptedAccount {
    postingKey: string;
    activeKey?: string;
}

class AccountStorageServiceImpl {
    private client: Client;

    constructor() {
        this.client = new Client(HIVE_NODES);
    }

    /**
     * Get all stored accounts
     */
    async getAccounts(): Promise<StoredAccount[]> {
        try {
            const accountsJson = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);
            if (!accountsJson) {
                return [];
            }
            return JSON.parse(accountsJson);
        } catch (error) {
            console.error('Error reading accounts:', error);
            return [];
        }
    }

    /**
     * Get a specific account by username
     */
    async getAccount(username: string): Promise<StoredAccount | null> {
        const accounts = await this.getAccounts();
        return accounts.find((acc) => acc.username === username) || null;
    }

    /**
     * Check if an account exists
     */
    async accountExists(username: string): Promise<boolean> {
        const account = await this.getAccount(username);
        return account !== null;
    }

    /**
     * Check if an account has an active key stored
     */
    async hasActiveKey(username: string): Promise<boolean> {
        const account = await this.getAccount(username);
        return !!(account?.encryptedActiveKey && account?.activeSalt && account?.activeIv);
    }

    /**
     * Validate a Hive posting key against the blockchain
     */
    async validatePostingKey(username: string, postingKey: string): Promise<boolean> {
        try {
            const privateKey = PrivateKey.fromString(postingKey);
            const publicKey = privateKey.createPublic().toString();

            const accounts = await this.client.database.getAccounts([username]);
            if (!accounts || accounts.length === 0) {
                return false;
            }

            const account = accounts[0];
            const postingAuth = account.posting;

            // Check if the public key matches any posting authority
            return postingAuth.key_auths.some(([key]) => key === publicKey);
        } catch (error) {
            console.error('Error validating posting key:', error);
            return false;
        }
    }

    /**
     * Validate a Hive active key against the blockchain
     */
    async validateActiveKey(username: string, activeKey: string): Promise<boolean> {
        try {
            const privateKey = PrivateKey.fromString(activeKey);
            const publicKey = privateKey.createPublic().toString();

            const accounts = await this.client.database.getAccounts([username]);
            if (!accounts || accounts.length === 0) {
                return false;
            }

            const account = accounts[0];
            const activeAuth = account.active;

            // Check if the public key matches any active authority
            return activeAuth.key_auths.some(([key]) => key === publicKey);
        } catch (error) {
            console.error('Error validating active key:', error);
            return false;
        }
    }

    /**
     * Add a new account with encrypted keys
     */
    async addAccount(
        username: string,
        postingKey: string,
        pin: string,
        activeKey?: string
    ): Promise<void> {
        // Validate posting key
        const isValidPosting = await this.validatePostingKey(username, postingKey);
        if (!isValidPosting) {
            throw new Error('Invalid posting key for this account');
        }

        // Validate active key if provided
        if (activeKey) {
            const isValidActive = await this.validateActiveKey(username, activeKey);
            if (!isValidActive) {
                throw new Error('Invalid active key for this account');
            }
        }

        // Encrypt posting key
        const { encrypted: encryptedPostingKey, salt: postingSalt, iv: postingIv } =
            await encryptWithPin(postingKey, pin);

        // Encrypt active key if provided
        let encryptedActiveKey: string | undefined;
        let activeSalt: string | undefined;
        let activeIv: string | undefined;

        if (activeKey) {
            const activeEncrypted = await encryptWithPin(activeKey, pin);
            encryptedActiveKey = activeEncrypted.encrypted;
            activeSalt = activeEncrypted.salt;
            activeIv = activeEncrypted.iv;
        }

        // Get existing accounts
        const accounts = await this.getAccounts();

        // Check if account already exists
        const existingIndex = accounts.findIndex((acc) => acc.username === username);

        const newAccount: StoredAccount = {
            username,
            encryptedPostingKey,
            postingSalt,
            postingIv,
            encryptedActiveKey,
            activeSalt,
            activeIv,
            avatar: '', // Will be populated by avatar service
            lastUsed: Date.now(),
        };

        if (existingIndex >= 0) {
            // Update existing account
            accounts[existingIndex] = newAccount;
        } else {
            // Add new account
            accounts.push(newAccount);
        }

        // Save to SecureStore
        await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    }

    /**
     * Add an active key to an existing account
     */
    async addActiveKeyToAccount(
        username: string,
        activeKey: string,
        pin: string
    ): Promise<void> {
        const account = await this.getAccount(username);
        if (!account) {
            throw new Error('Account not found');
        }

        // Validate active key
        const isValid = await this.validateActiveKey(username, activeKey);
        if (!isValid) {
            throw new Error('Invalid active key for this account');
        }

        // Verify PIN by attempting to decrypt posting key
        try {
            await decryptWithPin(
                account.encryptedPostingKey,
                pin,
                account.postingSalt,
                account.postingIv
            );
        } catch (error) {
            throw new Error('Incorrect PIN');
        }

        // Encrypt active key
        const { encrypted: encryptedActiveKey, salt: activeSalt, iv: activeIv } =
            await encryptWithPin(activeKey, pin);

        // Update account
        const accounts = await this.getAccounts();
        const accountIndex = accounts.findIndex((acc) => acc.username === username);

        if (accountIndex >= 0) {
            accounts[accountIndex] = {
                ...accounts[accountIndex],
                encryptedActiveKey,
                activeSalt,
                activeIv,
                lastUsed: Date.now(),
            };

            await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }
    }

    /**
     * Unlock an account with PIN (decrypt keys)
     */
    async unlockAccount(username: string, pin: string): Promise<DecryptedAccount> {
        const account = await this.getAccount(username);
        if (!account) {
            throw new Error('Account not found');
        }

        try {
            // Decrypt posting key
            const postingKey = await decryptWithPin(
                account.encryptedPostingKey,
                pin,
                account.postingSalt,
                account.postingIv
            );

            // Decrypt active key if present
            let activeKey: string | undefined;
            if (account.encryptedActiveKey && account.activeSalt && account.activeIv) {
                activeKey = await decryptWithPin(
                    account.encryptedActiveKey,
                    pin,
                    account.activeSalt,
                    account.activeIv
                );
            }

            // Update lastUsed timestamp
            await this.updateLastUsed(username);

            return { postingKey, activeKey };
        } catch (error) {
            throw new Error('Incorrect PIN');
        }
    }

    /**
     * Update the lastUsed timestamp for an account
     */
    async updateLastUsed(username: string): Promise<void> {
        const accounts = await this.getAccounts();
        const accountIndex = accounts.findIndex((acc) => acc.username === username);

        if (accountIndex >= 0) {
            accounts[accountIndex].lastUsed = Date.now();
            await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }
    }

    /**
     * Remove an account
     */
    async removeAccount(username: string): Promise<void> {
        const accounts = await this.getAccounts();
        const filteredAccounts = accounts.filter((acc) => acc.username !== username);
        await SecureStore.setItemAsync(
            ACCOUNTS_STORAGE_KEY,
            JSON.stringify(filteredAccounts)
        );
    }

    /**
     * Check if there are any accounts stored
     */
    async hasAccounts(): Promise<boolean> {
        const accounts = await this.getAccounts();
        return accounts.length > 0;
    }

    /**
     * Check for legacy account data (pre-PIN era)
     */
    async hasLegacyAccount(): Promise<boolean> {
        try {
            const username = await SecureStore.getItemAsync('hive_username');
            const postingKey = await SecureStore.getItemAsync('hive_posting_key');
            return !!(username && postingKey);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get legacy account credentials for migration
     */
    async getLegacyAccount(): Promise<{ username: string; postingKey: string } | null> {
        try {
            const username = await SecureStore.getItemAsync('hive_username');
            const postingKey = await SecureStore.getItemAsync('hive_posting_key');
            if (username && postingKey) {
                return { username, postingKey };
            }
            return null;
        } catch (error) {
            console.error('Error reading legacy account:', error);
            return null;
        }
    }

    /**
     * Delete legacy account data after migration
     */
    async deleteLegacyAccount(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync('hive_username');
            await SecureStore.deleteItemAsync('hive_posting_key');
        } catch (error) {
            console.error('Error deleting legacy account:', error);
        }
    }
}

// Export singleton instance
export const AccountStorageService = new AccountStorageServiceImpl();
