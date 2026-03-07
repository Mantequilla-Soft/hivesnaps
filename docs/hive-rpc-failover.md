# Hive RPC Node Failover

## Problem

`@hiveio/dhive`'s `Client` class does **not** automatically failover to another
RPC node when the current one is down in a React Native environment. Passing
multiple nodes to `new Client([node1, node2, node3])` only sets the first node
as the active endpoint — the others are ignored at runtime.

This meant that if `api.hive.blog` (or whichever node was first in the list)
went down, the entire app would fail with network errors instead of
transparently switching to a healthy node.

## Solution

A centralized `HiveClient` service (`services/HiveClient.ts`) that provides:

1. **Single source of truth for RPC nodes** — the `HIVE_NODES` array is defined
   once and exported for any consumer that needs it.
2. **Shared client singleton** — `getHiveClient()` returns the current `Client`
   instance, which is rebuilt when a node rotation occurs.
3. **Automatic failover** — `hiveCallWithFailover(fn)` wraps any dhive operation
   and, on network failure, rotates to the next node and retries. It tries each
   node once before giving up. Non-network errors (e.g. invalid parameters) are
   thrown immediately without retry.

## API

```ts
import { getHiveClient, hiveCallWithFailover, HIVE_NODES } from '../services/HiveClient';

// Simple access to the current client (no failover)
const client = getHiveClient();

// Recommended: wrap operations for automatic failover
const accounts = await hiveCallWithFailover(
  client => client.database.getAccounts(['alice'])
);

// Broadcast operations also get failover protection
await hiveCallWithFailover(client =>
  client.broadcast.comment(commentOp, privateKey)
);
```

## How failover works

1. `hiveCallWithFailover` calls the operation with the current client instance.
2. If the call throws a **network error** (timeout, connection refused, 502/503,
   etc.), it rotates to the next node in the `HIVE_NODES` list and retries.
3. It tries each node once (up to `HIVE_NODES.length` attempts total).
4. If all nodes fail, the last error is thrown.
5. **Non-network errors** (invalid account, malformed transaction, etc.) are
   thrown immediately without retrying — these would fail on any node.

The node rotation is global: if one operation triggers a rotation, all
subsequent operations (across the app) use the new node. This is intentional —
if a node is down, it's down for everyone.

## Network error detection

The following patterns in error messages trigger a retry:

- `network request failed`, `fetch failed`
- `timeout`, `etimedout`, `aborted`
- `econnrefused`, `econnreset`, `enotfound`, `socket hang up`
- `unable to resolve host`, `could not connect`
- HTTP status codes: `502`, `503`, `504`, `520`-`524`

## Migration guide (for Rider app)

The previous pattern had every hook/service defining its own node list and
client:

```ts
// BEFORE (duplicated in 20+ files)
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Usage
const accounts = await client.database.getAccounts(['alice']);
```

Replace with:

```ts
// AFTER
import { hiveCallWithFailover } from '../services/HiveClient';

// Usage — automatic failover on node failure
const accounts = await hiveCallWithFailover(
  client => client.database.getAccounts(['alice'])
);
```

Steps to migrate:

1. **Copy `services/HiveClient.ts`** into the Rider app's services directory.
   Update the `HIVE_NODES` array if the Rider app uses different nodes.
2. **For each file** that imports `Client` from `@hiveio/dhive`:
   - Remove the local `HIVE_NODES` array and `new Client(...)` call.
   - If `Client` is the only dhive import, replace the entire import with the
     HiveClient import. If other symbols are needed (e.g. `PrivateKey`), keep
     the dhive import but remove `Client`.
   - Wrap all `client.xxx()` calls with `hiveCallWithFailover(client => client.xxx())`.
3. **For class-based services** (like `AccountStorageService`): import
   `HIVE_NODES` for the constructor default, and use `hiveCallWithFailover` for
   the actual API calls.

## Files changed in this PR

### New
- `services/HiveClient.ts` — centralized client with failover

### Updated (removed local HIVE_NODES + Client, using hiveCallWithFailover)

**Hooks:**
- `hooks/useHiveData.ts`
- `hooks/useVotingPower.ts`
- `hooks/useFeedData.ts`
- `hooks/useReply.ts`
- `hooks/useCompose.ts`
- `hooks/useProfileData.ts`
- `hooks/useFollowManagement.ts`
- `hooks/useConversationData.ts`
- `hooks/useHivePostData.ts`
- `hooks/useUpvote.ts`
- `hooks/useUserProfile.ts`
- `hooks/useUpvoteManagement.ts`
- `hooks/useRewardsManagement.ts`
- `hooks/useEdit.ts`
- `hooks/useSearch.ts`
- `hooks/useUserSnaps.ts`
- `hooks/useAvatarManagement.ts`
- `hooks/useResourceCredits.ts`

**Services:**
- `services/AccountStorageService.ts`
- `services/ModerationService.ts`

**Utils:**
- `utils/extractHivePostInfo.ts`
- `utils/postTypeDetector.ts`
- `utils/notifications.ts`
