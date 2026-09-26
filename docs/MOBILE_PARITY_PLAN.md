# Mobile Parity Plan (HiveSnaps ↔ snapie.io)

Working notes for the ongoing effort to bring HiveSnaps' mobile UX closer to
snapie.io (`Mantequilla-Soft/snapie-io`) and to track same-backend features
snapie.io already ships that HiveSnaps doesn't yet expose. HiveSnaps and
snapie.io share the same Snapie Points backend (`services/pointsService.ts`
calls `https://snapie.io/api/...` directly), so several of these are UI-only
ports, not new backend work.

Status key: ✅ done · 🏗️ in progress · 🔜 planned, not started · 💤 noted, no action yet.

## ✅ Phase 1 — Simplify the feed

Removed the "My Snaps" chip from the feed filter row (`FeedScreen.tsx`,
`useFeedData.ts`). Own content is reachable via avatar tap → `ProfileScreen`,
matching snapie's pattern of never surfacing a self-filter in the main feed.

## ✅ Phase 2 — Header/nav condensing

Implemented per the agreed spec, mirroring snapie's `MobileHeader.tsx` +
`BottomTabBar.tsx`:

- `FeedScreen.tsx`'s top bar is now condensed to avatar (left) + search +
  notification bell (right) only. VP/RC and the "What's snappening today?"
  slogan row are gone from the header entirely.
- New `app/components/BottomTabBar.tsx`: Home · Blogs · Compose (elevated
  center FAB, replaces the slogan-tap entry point) · Hangouts · Profile.
  Blogs is now purely a bottom-tab destination (`setActiveFeed('blogs')`)
  rather than sharing a chip row with content filters.
- Feed filter pills are now Following/Newest/Trending only, directly under
  the slim header (the "Blogs" chip moved out, see above).
- VP/RC relocated to `ProfileScreen` (new `VotingPowerSection.tsx`,
  own-profile only) as a permanent readout, plus a small inline readout
  inside `UpvoteModal` at the moment of voting (it previously only showed
  the vote-weight slider) — nothing lost by moving VP out of the header.

**Caveat — read before shipping:** HiveSnaps' navigation is a flat
expo-router `Stack` (`app/_layout.tsx`), not a `Tabs` layout, so
`BottomTabBar` is a manually-rendered component mounted on `FeedScreen`
only, not a true persistent-across-every-screen tab bar. It's the lower-risk
option given no route restructuring was in scope this pass, but it means
the bar disappears once you navigate off the feed (Profile, Conversation,
etc.) — revisit as a real `Tabs` migration if that's not acceptable. Also:
none of this phase's UI was run on a device/simulator (this environment has
no way to launch Expo) — check it on-device before merging, especially the
bottom bar's height/padding against the feed `FlatList`'s bottom inset.

Not copying: Shorts, Chat, OpenPods-as-bottom-tab, Patrons filter, snapie's
multi-theme system — snapie-specific and out of scope here.

## ✅ Notifications rework

Was capped at a hard 50 with no pagination, and read-status was a local
SecureStore ID list (device-only, invisible to other Hive apps). Now:

- `utils/notifications.ts`: `fetchNotifications` takes `last_id` for real
  pagination against `bridge.account_notifications`. Added
  `fetchUnreadNotificationState` (`bridge.unread_notifications`) and
  `broadcastSetLastRead` (`custom_json` `notify`/`setLastRead`) — the same
  read-cursor protocol PeakD/Ecency/hive.blog use, so read status syncs
  across apps instead of being device-local. Fixed a latent bug where Hive's
  `Z`-less UTC dates were parsed as local time (`parseHiveDate` now
  normalizes this everywhere dates get compared).
- `hooks/useNotifications.ts`: rewritten around the chain cursor;
  `refresh()`/`loadMore()` page properly, `markAllAsRead()` broadcasts a real
  transaction instead of writing to `SecureStore`.
- `app/screens/NotificationsScreen.tsx`: infinite scroll via `onEndReached`.
  Tapping a notification no longer auto-marks it read (that would spend RC
  on every tap just from browsing) — "Mark all read" is the only
  read-marking action, matching snapie's own `NotificationsComp.tsx` exactly.

## ✅ Leaderboard avatars

`PointsLeaderboardScreen.tsx` rows now show each user's avatar
(`getAvatarImageUrl`, the existing `images.hive.blog` deterministic-URL
helper — same one the feed already uses) next to rank/username/points.

## 🏗️ "The Pile" — item-throwing on posts/snaps

### Mechanics (from the spike)

Read `lib/points/marketService.ts` and every route under
`app/api/points/market/` directly (not just the client wrapper) to pin down
exact contracts. Full model:

- Users spend Snapie Points to *buy* market items (a small catalog of named,
  imaged items — admin-seeded or user-submitted for a flat
  `ITEM_CREATION_FEE` = 50 points, burned on submission whether approved or
  not, capped at 3 submissions/user/day). A bought item becomes a unit in
  the buyer's inventory.
- From any post/snap, throwing consumes one owned unit and is idempotent
  per unit (a unit can only ever be thrown once — enforced by an
  ownerUsername+status guard server-side, not just a client-side check).
- Throwing anonymously costs an *additional* burn of the item's price on
  top of consuming the unit — claim-then-charge, so if the burn fails the
  claim is rolled back rather than leaving a paid-for-nothing throw. Real
  identity is always stored server-side for moderation, only redacted to
  "Anonymous" in the public read API.
- "The Pile" for a target is everything thrown at it, grouped by item with
  a count and up to `MAX_THROWERS_PER_ITEM` (50) recent throwers.
- Creator economics: `ITEM_CREATOR_SHARE_BP` = 70% of each sale goes to the
  item's creator, the rest is burned outright (not paid to the platform) —
  deliberate, so an alt-account self-buy loop is lossy, not free money.
  Buying your own item is blocked outright (`self_purchase`); creators get
  one free unit of their own item via a separate claim endpoint instead.

### ⚠️ Blocking dependency — confirm before writing any code

The market is gated **server-side**, not just behind a client feature flag:
every write route (`throw`, `buy`, item creation) checks
`ITEM_MARKET_FEATURE_FLAG && passesPointsAllowlist(username)` from
`lib/points/config.ts`, and rejects with `403 {error:'not_enrolled'}`
otherwise. `passesPointsAllowlist` reads an explicit username allowlist from
`POINTS_ALLOWLIST`/`NEXT_PUBLIC_POINTS_ALLOWLIST` env vars on snapie.io's own
deployment — HiveSnaps has no control over this from its own codebase or
repo. Read-only endpoints (`GET pile`, `GET items` catalog) are NOT
allowlist-gated, only the money-moving ones are.

This means: before implementation, confirm (a) whether the market is meant
to go fully public soon, or stays allowlist-limited for a while, and (b) who
controls that allowlist / whether HiveSnaps' target users are already on it.
Building the full throw/buy UI against an allowlist most HiveSnaps users
aren't on means everyone else hits a silent `not_enrolled` wall — the UI
needs to degrade gracefully either way (see Phase 4 below), but *how much*
of this to build now depends on the answer.

### API contracts (confirmed from route handlers + marketService.ts)

| Endpoint | Auth | Request | Response |
|---|---|---|---|
| `GET /api/points/market/pile/:author/:permlink` | none (public) | — | `{ pile: PileEntry[] }` |
| `GET /api/points/market/items?sort=hot\|new&offset=N` | none (public) | — | `{ items: ItemDTO[], hasMore }` |
| `GET /api/points/market/inventory` | Bearer JWT | — | `{ inventory: InventoryEntry[] }` |
| `POST /api/points/market/throw` | Bearer JWT | `{unitId, targetAuthor, targetPermlink, targetType: 'post'\|'snap', anonymous?}` | `{status: 'thrown'\|'not_found'\|'insufficient_balance', balance}` |
| `POST /api/points/market/items/:itemId/buy` | Bearer JWT | `{purchaseRefKey}` (client-generated UUID, idempotency key) | `{status: 'purchased'\|'already_purchased'\|'insufficient_balance'\|'item_not_found'\|'self_purchase', unitId, balance}` |
| `POST /api/points/market/items/:itemId/claim` | Bearer JWT | — | `{status: 'claimed'\|'item_not_found'\|'not_owner', unitId}` (creator's free unit of their own item) |
| `POST /api/points/market/items` | Bearer JWT | `{name, description, imageUrl, price}` | `{status: 'submitted'\|'capped'\|'insufficient_balance', item, balance}` |

```ts
interface ItemDTO { id: string; creatorUsername: string; name: string; description: string; imageUrl: string; price: number; purchaseCount: number }
interface InventoryEntry { item: ItemDTO; unitIds: string[] }
interface PileThrower { username: string; createdAt: string; anonymous: boolean }
interface PileEntry { item: ItemDTO; count: number; recentThrowers: PileThrower[] }
```

Auth: identical Bearer-JWT pattern HiveSnaps already uses for points
awarding — `pointsAuthService.getPointsAuthToken()` (challenge/sign/verify
with the posting key, cached in AsyncStorage) — no new auth plumbing.
`services/pointsService.ts`'s `awardPoints()` is the exact template for a
fetch-with-timeout-and-bearer-token call to copy for the write endpoints.

### Phased implementation plan

**Phase 0 — `pileService.ts`** (`services/pileService.ts`, mirrors
`pointsService.ts`'s shape exactly: module-level cooldown on read failures,
`fetchWithTimeout`, typed results). Six functions: `getPile(author,
permlink)`, `listMarketItems(sort, offset)`, `getMyInventory()`,
`buyItem(itemId, price)` (generates its own `purchaseRefKey` via
`crypto.randomUUID()` — confirm RN/Expo has this or needs a polyfill),
`throwItem(unitId, target, anonymous)`, `claimOwnItem(itemId)`. Pure data
layer, no UI — independently testable once written.

**Phase 1 — Read-only Pile display** (ships even if throw/buy stay
allowlist-gated, since `getPile` is public): a Pile row under `Snap.tsx`'s
existing action row (upvote/comment/payout — see `Snap.tsx:~1113-1310`),
rendering `getPile()`'s grouped items as pill badges (icon + count). Tap →
a bottom sheet/modal listing recent throwers (avatar + username, or
"Anonymous"), RN equivalent of `PileThrowersModal.tsx`. No auth needed for
this phase at all.

**Phase 2 — Throwing**: a "Throw something" affordance on the pill row that
opens a modal over `getMyInventory()` (RN equivalent of
`ThrowItemButton.tsx`) — same `Modal`+list pattern already used by
`UpvoteModal.tsx`/`StaticContentModal.tsx`, not a new sheet primitive. Empty
inventory state links to Phase 3's market screen. Handle all four
`throwItem` statuses explicitly, especially `insufficient_balance` (for the
anonymous-throw surcharge) and the silent-403 `not_enrolled` case from the
blocking dependency above — needs its own explicit message, not a generic
error toast, so a non-allowlisted user understands why nothing happened.

**Phase 3 — Buying / catalog screen**: a lightweight market screen (catalog
via `listMarketItems`, buy via `buyItem`) so people with an empty inventory
aren't dead-ended. **Open nav decision**: where this lives (own screen
reached from Profile/Wallet, vs. a section inside `WalletScreen`) — decide
alongside Phase 2's tab-bar shape rather than bolting on a destination
later. Creating new items and the creator-claim flow are lower priority
than buying/throwing — could ship Phase 3 as buy-only first.

**Phase 4 — Polish**: optimistic local pile updates on a successful throw
(mirrors `ITEM_THROWN_EVENT`'s role in `PileTray.tsx` — patch state
directly instead of refetching), and the graceful-degradation UI for
`not_enrolled` if the market is still allowlist-limited when this ships
(e.g. hide the throw button entirely rather than showing one that always
fails, once a user's `not_enrolled` status is known).

### Resolved
1. **Allowlist**: not actually a blocker — the allowlist is controlled by
   whoever holds the `POINTS_ALLOWLIST` env var on snapie.io's deployment,
   and that's us. Add HiveSnaps' target accounts there as needed; build the
   full feature (throw + buy), not just the read-only phase.
2. **Catalog nav placement (Phase 3)**: lives inside `WalletScreen` as a
   section/tab, not a separate destination.
3. **Sequencing**: build Phase 0 (`pileService.ts`) now, continue straight
   through the phases rather than pausing between them.

In progress — sized as its own multi-phase implementation pass.

## 💤 CI/CD pipeline (noted, no action yet)

Set up CI/CD for HiveSnaps. Must include: building an APK and uploading it
to a GitHub Release (or similar), so people who don't want to go through the
Play Store/App Store can still install directly. Not scoped or started —
revisit when we're ready to design the pipeline (build matrix, signing,
release triggers, where EAS Build fits given `eas.json` already exists in
the repo).
