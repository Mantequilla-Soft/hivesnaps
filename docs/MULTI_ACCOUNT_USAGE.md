# Multi-Account Usage Guide

HiveSnaps supports multiple Hive accounts on a single device. You can add, switch between, and remove accounts without logging out.

---

## Adding Your First Account

1. Open HiveSnaps and tap **Log In**
2. Enter your Hive username and posting key
3. Your account is stored securely on your device and you're taken to the feed

---

## Adding a Second Account

1. Tap your avatar or go to your **Profile**
2. Tap **Switch Account**
3. On the Account Selection screen, tap **Add Account**
4. Enter the username and posting key for the new account
5. The app switches to the new account immediately

---

## Switching Accounts

1. Go to your **Profile**
2. Tap **Switch Account**
3. Tap any account in the list to switch to it

Switching is instant — no re-entering keys required.

---

## Removing an Account

1. Go to **Switch Account**
2. Swipe left on the account you want to remove (or use the delete button)
3. Confirm the removal

Removing an account deletes all stored keys for that account from your device.

---

## Active Key (Optional)

The **active key** unlocks wallet-level operations:

- Updating your profile avatar
- Future: token transfers, witness votes, and other account-level actions

### Adding an Active Key

1. Go to your **Profile**
2. If you see **"Posting Only"** in the key badge, tap **+ Add Active Key**
3. Enter your Hive active private key (starts with `5J...`)
4. If your device has biometrics or a passcode set up, you'll be prompted to confirm your identity
5. The key is validated against the blockchain before being stored

### What the key badges mean

| Badge | Meaning |
|-------|---------|
| **Full Access** | Posting key + active key stored — all features available |
| **Posting Only** | Only posting key stored — social features work, wallet features require active key |

---

## Upgrading from an Older Version

If you installed HiveSnaps before multi-account support was added, you'll see an **Account Upgrade** screen on your first launch after updating.

Tap **Upgrade My Account** — your existing account and posting key are migrated to the new secure format automatically. Nothing is lost.

---

## Security Notes

- All keys are stored in your device's secure enclave (the same storage used by banking and payment apps)
- Keys are **never sent to any server**
- Active key operations require device authentication (Face ID, fingerprint, or passcode) when available
- Removing an account permanently deletes its keys from your device
