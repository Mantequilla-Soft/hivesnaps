# Active Key Security

## What is the Active Key?

Hive accounts have two commonly-used private keys:

| Key | What it can do |
|-----|---------------|
| **Posting key** | Post, comment, vote, follow — day-to-day social actions |
| **Active key** | Transfer tokens, update account metadata, vote for witnesses — wallet-level actions |

HiveSnaps requires only your **posting key** to use the app. The active key is **optional** and only needed for wallet operations (avatar updates today, token transfers in a future release).

---

## How the Active Key is Stored

The active key is stored in `expo-secure-store` under the key `account_{username}_activeKey`.

`expo-secure-store` maps to:
- **iOS**: Keychain Services with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — the key is hardware-encrypted and only accessible when the device is unlocked
- **Android**: `EncryptedSharedPreferences` backed by the Android Keystore — AES-256-GCM encryption with hardware-backed key management where the device supports it

The key **never leaves the device** and is never sent to HiveSnaps servers or any third party.

---

## Biometric Gate

When a user adds their active key, HiveSnaps calls `localAuthService.authenticate()` before storing it — provided the device has biometrics or a passcode enrolled. This means:

- The user must prove physical possession of the device at the moment of key storage
- On devices with no security enrolled (uncommon; typically CI/emulators), the biometric step is skipped — the key is still hardware-encrypted by `SecureStore`

Subsequent operations that use the active key (e.g. avatar update) retrieve the key from `SecureStore` directly. Adding per-operation biometric prompts is straightforward via `localAuthService.authenticate()` and should be done for any high-value operation (transfers, etc.).

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Physical device theft | Keys inaccessible without device unlock; biometric/PIN required |
| Malware on device | `SecureStore` keys are sandboxed per-app; other apps cannot read them |
| Network interception | Keys are never transmitted |
| App binary inspection | Keys are not in source code or app bundle |
| Server breach | Server holds no keys |
| Backup extraction | `SecureStore` keys are excluded from device backups |
| Memory dump | Keys are loaded into memory only during signing; not persisted in app state |

---

## What to Tell Users

> Your active key is stored in the same secure vault your phone uses for Face ID, Apple Pay, and banking apps. It never leaves your device and is never sent to any server — not even ours.
>
> You only need it for wallet actions. For normal posting and voting, your posting key is all HiveSnaps ever uses.

---

## Developer Notes

- Never log or expose key material, even in `__DEV__` builds
- Never store key material in React state or Redux — always read from `AccountStorageService` at the point of use
- The `addActiveKey()` method validates the key against the blockchain before storing it — it will reject invalid or mismatched keys
- Use `requireActiveKey()` from `useAuth` as the standard gate: it handles the "no key yet" UX flow automatically
