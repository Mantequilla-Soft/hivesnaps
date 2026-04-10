# Multi-Account Architecture

## Overview

Multi-account support is built around a central `AccountStorageService` that manages all account data in `expo-secure-store`. The app store tracks the active session; the service owns persistence.

---

## Storage Layout

All data lives in `expo-secure-store` under versioned, per-account keys:

| Key | Value | Notes |
|-----|-------|-------|
| `account_list` | JSON array of `StoredAccount` objects | Metadata only — no keys |
| `account_{username}_postingKey` | WIF posting key | Required |
| `account_{username}_activeKey` | WIF active key | Optional |
| `hive_current_account` | Current username string | Session pointer |

Legacy v1 keys (`hive_username`, `hive_posting_key`) are migrated automatically on first `getAccounts()` call.

---

## Key Services

### `AccountStorageService` (`services/AccountStorageService.ts`)

The single source of truth for account persistence. All reads and writes go through this service.

**Key methods:**

```ts
// Add or update an account (validates keys against blockchain)
addAccount(username, postingKey, activeKey?) → Promise<void>

// List all stored accounts (triggers legacy migration if needed)
getAccounts() → Promise<StoredAccount[]>

// Read keys for an account
getAccountKeys(username) → Promise<AccountKeys | null>

// Active key management
addActiveKey(username, activeKey) → Promise<void>
removeActiveKey(username) → Promise<void>
hasActiveKey(username) → Promise<boolean>

// Session management
getCurrentAccountUsername() → Promise<string | null>
setCurrentAccountUsername(username) → Promise<void>

// Legacy detection (non-migrating check)
hasLegacyAccount() → Promise<boolean>
```

Thread safety: all write operations go through an internal `withModificationLock` serializer.

### `LocalAuthService` (`services/LocalAuthService.ts`)

Thin wrapper around `expo-local-authentication`. Used to gate active key operations behind device biometrics/PIN.

```ts
localAuthService.authenticate(promptMessage?) → Promise<void>
localAuthService.isAvailable() → Promise<boolean>
localAuthService.getCapabilities() → Promise<AuthCapabilities>
```

Throws `AuthCancelledError` on user cancellation, `AuthFailedError` on other failures.

---

## App Store

The Redux-style store (`store/`) tracks the active session in memory:

```ts
interface UserState {
  currentUsername: string | null;
  hasActiveKey: boolean;
  // ...auth token, error state
}
```

`hasActiveKey` is set at login time by reading `AccountStorageService.hasActiveKey()`. It is **not** re-read on every operation — the source of truth for the actual key is always `AccountStorageService`.

---

## Startup Flow

`app/index.tsx` runs this decision tree on every cold start:

```
hasLegacyAccount()?
  YES → MigrationScreen
  NO  → getAccounts()
          empty → LoginScreen
          not empty → getCurrentAccountUsername()
                        null → AccountSelectionScreen
                        set  → getAccountKeys() → auto-login → FeedScreen
```

---

## Screens

| Screen | Purpose |
|--------|---------|
| `LoginScreen` | First login / add account |
| `AccountSelectionScreen` | List accounts, switch, add, remove |
| `AddActiveKeyScreen` | Enter and store active key with biometric confirmation |
| `MigrationScreen` | One-time upgrade from v1 storage format |

---

## Migration from v1

Legacy storage used two flat keys: `hive_username` and `hive_posting_key`.

The migration:
1. `hasLegacyAccount()` checks for these keys without side effects
2. If found, `MigrationScreen` is shown
3. User taps "Upgrade" → `getAccounts()` is called
4. `migrateFromLegacyStorage()` runs internally: reads v1 keys, calls `addAccount()`, writes `hive_current_account`, deletes v1 keys
5. Migration is idempotent (guarded by an in-memory `migrationDone` flag per session)

---

## Adding New Active Key Operations

When adding a new feature that requires the active key:

1. Call `requireActiveKey()` from `useAuth` — returns `true` if key exists, navigates to `AddActiveKeyScreen` and returns `false` if not
2. If `true`, fetch the key via `accountStorageService.getAccountKeys(username)`
3. Use `keys.activeKey` to sign the operation
4. Optionally prompt biometrics via `localAuthService.authenticate()` before signing sensitive operations

```ts
const proceed = requireActiveKey();
if (!proceed) return; // user redirected to add key screen

const keys = await accountStorageService.getAccountKeys(currentUsername);
if (!keys?.activeKey) return;

// sign and broadcast
```
