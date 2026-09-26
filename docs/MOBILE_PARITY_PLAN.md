# Mobile Parity Plan (HiveSnaps ↔ snapie.io)

Working notes for the ongoing effort to bring HiveSnaps' mobile UX closer to
snapie.io (`Mantequilla-Soft/snapie-io`) and to track same-backend features
snapie.io already ships that HiveSnaps doesn't yet expose. HiveSnaps and
snapie.io share the same Snapie Points backend (`services/pointsService.ts`
calls `https://snapie.io/api/...` directly), so several of these are UI-only
ports, not new backend work.

Status key: ✅ done · 🔜 planned, not started · 💤 noted, no action yet.

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

## 🔜 "The Pile" — item-throwing on posts/snaps

Spiked snapie-io's implementation (`components/shared/PileTray.tsx`,
`ThrowItemButton.tsx`, `PileThrowersModal.tsx`, `lib/points/marketClient.ts`,
`lib/points/marketConfig.ts`, `lib/db/models/ItemThrow.ts`). This is a full
item-market feature layered on Snapie Points, gated behind
`ITEM_MARKET_FEATURE_FLAG` on the web side:

**Mechanics:**
- Users spend Snapie Points to *buy* market items (a small catalog of named,
  imaged items — "items" are admin-seeded or user-submitted for a flat
  `ITEM_CREATION_FEE` = 50 points, burned on submission whether approved or
  not, capped at 3 submissions/user/day — the anti-spam lever). A bought
  item becomes a unit in the buyer's inventory (`getMyInventory`).
- From any post/snap, "Throw something" opens a picker over your inventory;
  throwing consumes one unit (`POST /api/points/market/throw` with
  `{unitId, targetAuthor, targetPermlink, targetType, anonymous}`) and is
  idempotent per unit (a unit can only ever be thrown once — the DB's unique
  index on `unitId` is the actual guard).
- Throwing anonymously costs an *additional* burn of the item's price on
  top of consuming the unit — the identity is still stored server-side for
  moderation, just redacted from the public API response.
- "The Pile" for a target = `GET /api/points/market/pile/[author]/[permlink]`
  → grouped `{item, count, recentThrowers[]}[]`, rendered as pill badges
  (icon + count) under the post; tapping a pill opens a "who threw this"
  modal (up to `MAX_THROWERS_PER_ITEM` = 50 recent throwers, avatar + name,
  or "Anonymous"). A live `ITEM_THROWN_EVENT` patches an already-mounted
  pile optimistically instead of refetching.
- Creator economics: item creator gets `ITEM_CREATOR_SHARE_BP` = 70% of each
  sale: the rest is burned outright (not paid to the platform) — deliberate,
  to keep an alt-account self-buy loop lossy instead of free money.

**Porting to HiveSnaps — what's reusable vs. new:**
- Auth is already solved: HiveSnaps' `pointsAuthService.ts` already gets the
  bearer JWT the web app's `authenticatedFetch` uses, so throw/buy calls
  need no new auth plumbing — same pattern as points-awarding today.
- New: a `pileService.ts` (mirrors `pointsService.ts`'s shape) wrapping
  `GET /api/points/market/pile/:author/:permlink`, `GET
  /api/points/market/inventory`, `POST /api/points/market/throw`, `GET
  /api/points/market/items` (catalog) and the buy endpoint — all against
  the existing `snapie.io` backend, no new server work.
- New UI, native equivalents of the web components:
  - A "Pile" row under `Snap.tsx` (pill badges + counts, tap → throwers
    bottom sheet) — RN equivalent of `PileTray.tsx` + `PileThrowersModal.tsx`.
  - A "Throw something" action opening an inventory bottom sheet (RN
    equivalent of `ThrowItemButton.tsx`), plus a lightweight market/catalog
    screen so people who own nothing yet can buy an item without leaving
    the app (web sends them to `/settings/points/market`; HiveSnaps needs
    its own screen or reuses `WalletScreen`'s pattern for something similar).
- Needs a design decision before implementation: where does "buy an item"
  live in HiveSnaps' nav (own screen vs. a tab inside the Wallet/Profile
  area) — worth deciding alongside the Phase 2 tab-bar shape rather than
  bolting on a sixth destination afterward.

Not started — this is a real feature slice (catalog + inventory + throwing +
pile display), sized for its own implementation pass, not a drive-by change.

## 💤 CI/CD pipeline (noted, no action yet)

Set up CI/CD for HiveSnaps. Must include: building an APK and uploading it
to a GitHub Release (or similar), so people who don't want to go through the
Play Store/App Store can still install directly. Not scoped or started —
revisit when we're ready to design the pipeline (build matrix, signing,
release triggers, where EAS Build fits given `eas.json` already exists in
the repo).
