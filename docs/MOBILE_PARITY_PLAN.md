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

**Found on first device run**: the old bottom-right floating "+" compose
button (`FeedScreen.tsx`'s `fab`/`fabIcon` styles) was never removed when
`BottomTabBar` added its own center compose FAB — it sat behind/overlapping
the new bar, fully redundant. Removed the button, its now-unused
`useSafeAreaInsets` call, and the dead `fab`/`fabIcon` styles from
`FeedScreenStyles.ts`.

**Correction**: the "Blogs" chip in the top filter row was likewise never
actually removed when `BottomTabBar` got its own Blogs tab, despite what
the bullet above originally claimed — both existed side by side, doing the
same `setActiveFeed('blogs')`. Now actually removed from the filter row
(caught by inspection, not a device run this time); filter pills are
genuinely Following/Newest/Trending only.

**Bug found on device — top bar not actually spread out.** The condensed
header looked cramped: avatar+username and search+bell sat bunched
together instead of at opposite ends. Cause: when condensing the header,
an extra wrapping `<View>` (with its own `flexDirection:'row',
justifyContent:'space-between'`) got added around the two groups, as the
*sole child* of `styles.topBar` — which already had that exact
`flexDirection`/`justifyContent`/`alignItems` set. In RN Flexbox, a row
container doesn't stretch a child along the main (horizontal) axis by
default, so that inner wrapper only sized to fit its content instead of
spanning the bar's full width — its own `space-between` had no extra room
to distribute, so everything collapsed to one side. Fixed by deleting the
redundant wrapper entirely and making the avatar/username `Pressable` and
the search/bell `View` direct children of `styles.topBar`, which already
had the right properties and (via its `SafeAreaView` parent) the full
screen width to work with.

**Correction — Hangouts moved back to the top bar, FAB rebalanced.** Once
Shorts was added as a 5th `BottomTabBar` destination (see the Shorts
section below), the bar was Home/Blogs/Shorts (3) · FAB · Hangouts/Profile
(2) — visibly off-center, caught by the user on-device. Moved Hangouts
back to the feed's top bar (next to search, its original spot before Phase
2 — same `useHangoutsCount()` polling hook and green `NotificationBadge`,
unchanged, just relocated) and rebalanced the remaining 4 bottom
destinations 2-and-2 around the FAB: Home/Blogs · FAB · Shorts/Profile.

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

**Found on first device run — real infinite loop, not just a caught error.**
The console showed `[HiveMuteService]` errors and `[AppProvider]` init logs
flooding continuously. Root cause was in the rewritten
`hooks/useNotifications.ts`'s muted-list loader:
`ensureMutedListLoaded`'s guard was `!mutedList || mutedList.length === 0 ||
needsMutedRefresh` — treating a *genuinely empty* muted list as "still needs
fetching" forever, not just a missing/stale cache. `fetchMutedList` never
throws (it catches internally and resolves to an empty `Set` on any
failure, including the "no auth session yet" case this device hit), so
every attempt called `setMutedList([])` with a **new** array reference each
time → `ensureMutedListLoaded`'s `useCallback` identity changed → the
`useEffect` watching it re-fired → fetch again → forever, as fast as the
microtask queue allowed. That's the flood: not a native crash, a tight
async loop pegging the JS thread. Fixed by dropping the `.length === 0`
check — cache presence/staleness (`needsRefresh`) is the only thing that
should ever trigger a refetch; `hooks/useFeedData.ts`'s equivalent
(`ensureMutedListCached`) already had this right and was the reference for
the fix. No regression test added yet (this hook has no dedicated test
file, and none of the others touched by the Pile work do either) — worth
adding if this file gets touched again.

## ✅ Leaderboard avatars

`PointsLeaderboardScreen.tsx` rows now show each user's avatar
(`getAvatarImageUrl`, the existing `images.hive.blog` deterministic-URL
helper — same one the feed already uses) next to rank/username/points.

**Correction — capped at the top 100.** The infinite-scroll pagination had
no ceiling, so the list would keep growing unbounded as the userbase does.
Capped at `MAX_ENTRIES = 100`: the initial/subsequent fetches now request
only however many entries are still needed to reach 100, and `hasMore`
forces `false` once the cap is hit even if the server would have more.

## ✅ Patrons feed filter

Mirrors snapie-io's Patrons tab (`hooks/useSnaps.ts`'s `'patrons'` filter
type there, filtering already-fetched snaps by author against a patrons
map — not a separate feed source). HiveSnaps already had the underlying
piece: `services/patronService.ts` (`getPatronTier`, used for the patron
badge already shown on snap cards) is close to a line-for-line port of
snapie's own `usePatronStatus`-backing service, same
`https://snapie.io/api/patrons` endpoint, same cache/backoff shape. Added
`getPatronsMap()` (the whole cached map, not just a single-account lookup)
and a new `hooks/usePatronList.ts` bridging that into a `Set<string>` for
filtering — a plain hook rather than shared-store state, since patrons
(unlike following/muted) isn't scoped per viewer.

Wired into `useFeedData.ts`'s existing `applyFilter` (new `'patrons'` case,
same `Set`-membership shape as `'following'`) and a new "Patrons" pill in
`FeedScreen.tsx`'s filter row (Following/Newest/Trending/Patrons) — the
row now has the space this used to share with the "Blogs" chip before that
moved to `BottomTabBar`. Covered by `hooks/__tests__/usePatronList.test.tsx`.
Verified: full suite now 245/245 (3 new), `tsc --noEmit` still clean.

## ✅ On-chain muted accounts (dropped the flaky backend)

HiveSnaps' feed-level muting used to depend on HiveSnaps' own backend: a
JWT-authenticated `/muted/` call plus a proprietary `/blacklisted` call
(`services/BlacklistService.ts`, now deleted), cached only in-memory for 5
minutes with no persistence and, critically, **failing open** on any error
(`return []` / `return new Set()`) — silently disabling muting rather than
erring on the side of filtering too much. There was even a design doc
(`docs/muted-list-fallback-implementation.md`, now removed as superseded)
describing this exact symptom.

Switched to snapie-io's approach instead: `services/HiveMuteService.ts`
now unions two on-chain sources directly via Hive's own bridge API —
`bridge.list_community_roles` (community-level muted members) and
`bridge.get_follow_list` with `follow_type: 'muted'` (the viewer's personal
mute/ignore relationship) — with no backend call at all. Caches the union
for 24h (module-level `Map`, in-memory), and **fails closed**: any refetch
error falls back to the last known cached result instead of an empty set,
so a flaky moment over-filters rather than under-filters. `fetchMutedList`
keeps its existing signature (`(username: string) => Promise<Set<string>>`),
so every consumer (`hooks/useFeedData.ts`, `hooks/useNotifications.ts`,
`app/screens/FeedScreen.tsx`, `app/screens/ConversationScreen.tsx`,
`app/screens/HivePostScreen.tsx`) needed no changes beyond stale comments.
`hooks/useFollowManagement.ts`'s mute/unmute handlers now also call the new
`clearMutedListCache` (alongside the existing app-store cache invalidation)
so a fresh mute/unmute is reflected immediately rather than waiting out the
24h cache. The app-wide store's own muted-list cache (`store/userSlice.ts`)
got a dedicated `CACHE_DURATIONS.MUTED_LIST` (24h, was reusing the 5-minute
`FOLLOWING_LIST` constant) so it stops invalidating faster than the data
actually changes.

The proprietary team blacklist was dropped rather than kept as a third
source — full parity with snapie-io, which has no equivalent concept, per
an explicit call to prefer that over retaining a backend dependency.

Covered by `services/__tests__/HiveMuteService.test.ts` (6 new tests:
union/dedup/lowercasing, cache hit, stale-cache-on-error fallback, empty
input, never-throws). Verified: full suite now 261/261, `tsc --noEmit`
still clean.

## ✅ Blog composer (repurposed from the snap composer)

Mirrors snapie-io: on the Blogs tab, the center FAB opens a blog composer
instead of the snap composer, publishing a real Hive root post rather than
a reply nested under the `@peak.snaps` container. Built by extending the
existing composer rather than forking it — most of the UI (image/GIF/video/
audio pickers, markdown toolbar, Preview modal) is identical between the
two, confirmed by checking how snapie-io itself shares one `createComposer`
op-builder between its own snap and blog composers (`@snapie/operations`).

- `hooks/useCompose.ts`: `ComposeMode` gained a `'blog'` value. New
  `title`/`tags` state, `setTitle`/`setTags` actions, and a `submitBlogPost`
  callback alongside the existing `submitPost`/`submitReply`/`submitEdit` —
  same shape, different op: `parent_author: ''`, `parent_permlink` set to
  the HiveSnaps community (`SNAPIE_COMMUNITY`, imported from
  `hooks/useBlogFeed.ts` rather than re-declared, since the Blogs feed
  already queries `bridge.get_ranked_posts` by that same tag — a new post
  needs to land there to actually show up), and a title-based permlink
  (`utils/blogPostUtils.ts`'s `generatePostPermlink`, slugify + timestamp
  suffix for uniqueness). `postSnapWithBeneficiaries` needed no changes —
  it already took `parentAuthor`/`parentPermlink`/`title` as plain
  parameters, so root posts and replies both flow through the same
  broadcast call. `hasPostableContent` requires a non-empty title *and*
  body in blog mode instead of the snap rule (any of text/image/gif/video/
  audio).
- `app/screens/ComposeScreen.tsx`: title input and a tags input (free text,
  parsed via `parseHiveTags` — space/comma/#-separated, lowercased,
  deduped) render only in blog mode; the 280-char cap and counter are
  snap-only. Preview prepends the title as a markdown H1 so the existing
  Preview modal needs no changes of its own.
- `app/components/BottomTabBar.tsx`: the compose FAB now checks
  `activeFeed` — `'blogs'` opens `ComposeScreen` with `mode: 'blog'`,
  `'snaps'` keeps today's behavior.
- Every blog post sends `@snapie` a beneficiary cut via `postSnapWithBeneficiaries`'s
  existing `hasHangout` flag — 3% normally, 10% if video/audio is attached
  (same weight logic hangout-announcement snaps already use).
- Community selection and draft autosave (both present in snapie-io's web
  blog composer) are deferred — v1 always targets the HiveSnaps community;
  beneficiaries are not yet user-editable, only the fixed cut above.

Covered by `utils/__tests__/blogPostUtils.test.ts` (10 new tests, permlink
slugification + tag parsing). Verified: full suite now 255/255,
`tsc --noEmit` still clean.

## 🏗️ Shorts — doomscroll video feed

Mirrors snapie-io's `/shorts`: a full-screen, vertical, autoplaying short-
video feed, entered from a new "Shorts" bottom-tab destination. Investigated
first via a research spike before building (see the spike's findings for
full detail); summary of what shipped:

**Composer-side correction (Phase 0)**: snapie-io's blog composer forces
`isShort: false` on 3Speak uploads; its snap composer leaves the field
unset (defaults to `true`). HiveSnaps' composer used to leave it unset in
*every* mode, meaning blog-post videos were accidentally being marked as
shorts too. `hooks/useVideoUpload.ts` now takes an `isShort` param (default
`true`); `hooks/useCompose.ts` passes `mode !== 'blog'`, so only snap/reply/
edit-mode uploads are shorts, matching snapie-io's actual behavior.

**Data source (Phase 1)**: like snapie-io, Shorts content comes from
3Speak's own global aggregation API (`checker.3speak.tv/shortssorted`), not
a Hive bridge query — there's no purpose-built "give me posts with videos"
query on the Hive side, and this endpoint is exactly what populates
snapie-io's own feed. `services/shortsService.ts` parses its response into
`ShortItem[]`; `hooks/useShorts.ts` adds pagination (page+seed, matching the
API's own shuffle-by-seed model), muted-account filtering (reusing
`fetchMutedList` from the on-chain muting work above), avatar enrichment,
and cross-page dedup (the API can plausibly repeat an item across pages
since it's shuffled/paginated rather than cursor-based).

**Correction — shipped broken, then fixed**: this dev environment's network
policy blocks outbound requests to `checker.3speak.tv`, so the first pass
guessed the response shape instead of confirming it, and guessed wrong:
`embed_url` was assumed to be a full `https://play.3speak.tv/embed?v=...`
URL and parsed with `new URL()`, which throws on the real API's bare
`"author/permlink"` string — every entry was silently dropped, so the feed
came back empty in the user's own testing. Fixed by reading snapie-io's
actual `hooks/useShorts.ts` source instead of inferring from other files:
`embed_url` is split on the first `/` (optionally stripping a leading `@`),
`hivePermlink` comes from that split while `permlink` (3Speak's own video
permlink, used for playback) is a separate top-level field, and a missing
author falls back to a top-level `owner` field — all confirmed against
snapie-io's real parsing, not guessed tolerance. `page`/`totalPages` and
the `data.shorts` wrapper key were already correct. Lesson: when a live
endpoint can't be reached to verify a shape, reading the reference
implementation's actual source beats writing "defensive" tolerance for
shapes that were never confirmed to be plausible in the first place.

**Viewing experience (Phase 2)**: `app/components/ShortVideoPlayer.tsx` is
a new inline/looping/full-bleed presentation of the same
`react-native-video` + 3Speak HLS pipeline `ThreeSpeakEmbed.tsx` already
uses for in-feed video — only the active slide plays, its two immediate
neighbors mount muted (buffering ahead for a smooth swipe), everything else
is an unmounted thumbnail, same windowing snapie-io's Swiper-based player
uses. `app/components/ShortCard.tsx` adds the interaction rail: like
(instant 100%-weight vote — a real broadcast, cross-referenced against
`get_content` for actual vote/comment state once a card goes active),
comment (opens the existing `ConversationScreen` thread), share (native
share sheet via the same `buildSnapieUrl` snaps already use), and a mute
toggle. `app/screens/ShortsScreen.tsx` is the vertical pager (`FlatList`
with `pagingEnabled`/`snapToInterval`/`onViewableItemsChanged` driving which
index is "active"), hiding all normal chrome (no header, no
`BottomTabBar`) for full immersion, with just a back button. Registered as
its own Stack screen (`app/_layout.tsx`) and reached via a new "Shorts" tab
in `BottomTabBar.tsx`.

**Deferred to a later phase** (present in snapie-io's own `ShortCard` but
intentionally out of this pass, matching how Pile staged buy before
throw-polish): long-press vote-weight slider (v1 is tap-only, fixed 100%),
an in-place comment bottom sheet (v1 navigates to the full
`ConversationScreen` instead), and a follow/mute-author overflow menu (v1's
`useShorts` already exposes `removeAuthor` for this, just not wired to any
UI yet).

Covered by `services/__tests__/shortsService.test.ts` (10 tests, rewritten
against the confirmed real shape: bare-string embed_url parsing, the `@`-
strip, the `owner` fallback, malformed-entry handling, `hasMore` math) and
`hooks/__tests__/useShorts.test.tsx` (6 tests: mute filtering, dedup across
pages, error handling, `removeAuthor`, refresh reshuffle). Verified: full
suite now 277/277, `tsc --noEmit` still clean. Not yet verified: actual
playback/scrolling on a device, since this container cannot run the app —
please confirm the feed now populates and test the real swipe/autoplay feel.

## ✅ Wallet: QR pay + avatar-on-manual-entry

Investigated via a research spike first (snapie-io's `components/wallet/`),
then built against the four things asked for. Reused heavily: HiveSnaps
already had a working Send HIVE/HBD form (`TransferModal.tsx`), active-key
storage + biometric signing (`useWalletOperations.ts`), avatar resolution
(`useAvatar`), and `get_account_history` parsing (`useAccountHistory.ts`)
— none of that changed. Every new piece calls into the existing signing
path; HiveSnaps does not adopt snapie-io's Aioha/Keychain-delegation model.

- **Avatar confirmation on manual entry** (was genuinely missing):
  `TransferModal.tsx` now does a debounced (1s) `client.database.getAccounts`
  existence check on the recipient field — idle/checking/found/not-found,
  disables Send on not-found, shows the recipient's avatar (via `useAvatar`)
  once confirmed. Direct port of snapie-io's `WalletModal.tsx` pattern.
- **QR payload format**: ported snapie-io's `hive://sign/op/<base64url>`
  scheme verbatim (`utils/hiveQr.ts` — `encodeHiveTransferQR`/
  `decodeHiveTransferQR`/`currencyFromAmount`/`valueFromAmount`), by explicit
  choice, so a HiveSnaps-generated QR and a snapie-io scanner (or vice
  versa) read each other. Uses the RN-global `btoa`/`atob` (native since RN
  0.74, no polyfill added).
- **Request Payment**: `app/components/wallet/RequestPaymentModal.tsx`
  renders the QR (new dependency: `react-native-qrcode-svg` +
  `react-native-svg`) with optional amount/currency/memo fields, and polls
  for the matching incoming transfer via the new
  `hooks/useIncomingPayment.ts` — a port of snapie-io's `QRRequestSheet`
  polling logic (5s interval, 15min timeout, matches recipient + currency +
  recency + amount, allowing overpayment, ignoring memo) built on the same
  `get_account_history` call `useAccountHistory.ts` already used, not a new
  API surface.
- **Scan to Pay**: `app/components/wallet/ScanPaymentModal.tsx` — `expo-camera`
  was already a declared dependency but unused anywhere in the app; wired up
  its `CameraView`/`onBarcodeScanned` (built into Expo SDK 54, no extra
  native module) to decode with the same `decodeHiveTransferQR`. A scan
  opens the existing `TransferModal` pre-filled (new optional `initialTo`/
  `initialAmount`/`initialMemo` props) rather than sending immediately — the
  scanner still reviews/edits before confirming. Added `expo-camera` to
  `app.json`'s plugins (needed for the Android `CAMERA` permission to be
  added at prebuild; iOS's `NSCameraUsageDescription` already existed from
  photo/video capture, broadened to mention QR scanning too).
- Both new actions ("Request Payment", "Scan to Pay") added to
  `WalletScreen.tsx`'s existing action grid.

Covered by `utils/__tests__/hiveQr.test.ts` (11 tests: encode/decode
round-trip, malformed input, wrong-op-type rejection) and
`hooks/__tests__/useIncomingPayment.test.tsx` (9 tests: match/no-match
cases, overpayment, wrong currency/recipient, pre-request transfers
ignored, never-throws). Verified: full suite now 297/297, `tsc --noEmit`
still clean. **Not verified**: actual QR scan/generate/detect on a device,
or genuine interop with a snapie-io scanner/generator — this container has
no camera and network policy blocks `checker.3speak.tv`-style live checks,
so please confirm the round-trip (generate on HiveSnaps → scan on
snapie-io, and the reverse) actually works before relying on it.

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

**✅ Phase 0 — `pileService.ts`** (`services/pileService.ts`). Six
functions: `getPile(author, permlink)`, `listMarketItems(sort, offset)`,
`getMyInventory()`, `buyItem(itemId, price)`, `throwItem(unitId, target,
item, anonymous)`, `claimOwnItem(itemId)`. `purchaseRefKey` is generated
locally (timestamp + `Math.random()`) rather than via `crypto.randomUUID()`
— it's just a client-side idempotency key, not a security token, and
RN/Hermes `crypto.randomUUID` availability isn't guaranteed without an
extra polyfill dependency. Added a matching `onPointsSpent`/
`emitPointsSpent` pair to `utils/pointsEvents.ts` (mirrors the existing
earned-points event and snapie.io's own `POINTS_SPENT_EVENT`), fired on a
real buy or an anonymous throw's burn. Covered by
`services/__tests__/pileService.test.ts`, same mocking pattern as
`pointsService.test.ts`. Verified for real (not just read-through) once
`node_modules` got installed this session: full suite (235 tests/17
suites) passes, `tsc --noEmit` is clean except one pre-existing unrelated
error.

**✅ Phase 1 — Read-only Pile display**. New `app/components/PileTray.tsx`
(pill badges — item image + count, renders nothing when the pile is empty
since there's no throw affordance yet to justify an empty state) and
`app/components/PileThrowersModal.tsx` (tap a pill → centered-card modal
listing recent throwers, avatar + username or "Anonymous" + relative time —
same modal shape as `UpvoteModal`/`StaticContentModal`, not a new sheet
primitive). Wired into `Snap.tsx` right after the vote/reply action row,
top-level snaps only for now (guarded on `!compactMode && !isReply` — reply
piling wasn't in scope for this phase, easy to extend later). No auth
needed, matches `getPile`'s public endpoint. Verified: full suite still 235
passing, `tsc --noEmit` still clean.

**✅ Phase 2 — Throwing**. `PileTray` now always renders when the viewer is
logged in (even with an empty pile — otherwise there'd be no way to be
first), with a "Throw" pill opening new `app/components/ThrowItemModal.tsx`:
an inventory picker (`getMyInventory()`) over the same centered-card `Modal`
pattern, each row offering "Throw" or an anonymous throw (🕵 icon button,
with its points-burn cost surfaced via `accessibilityLabel` and an
insufficient-balance alert if it's declined). A successful throw patches
`PileTray`'s local pile state directly (`onThrown` callback) instead of
refetching — same idea as snapie.io's `ITEM_THROWN_EVENT`, just as a normal
prop callback since thrower and tray are already parent/child here, with no
need for snapie's DOM-event indirection. Empty inventory shows a message
pointing at "buy from the market" — no link yet since Phase 3 (the actual
market screen) doesn't exist; wire it once that lands rather than ship a
dead link now.

Handles all `throwItem` outcomes distinctly: `thrown` (success),
`insufficient_balance` (anonymous-throw surcharge decline), `not_found`
(unit already thrown/not owned), and — the blocking dependency from
earlier — a 403 `{error:'not_enrolled'}` response. That last one needed a
`pileService.ts` change: added `NotEnrolledError` (a distinct thrown type)
and an `assertOk()` helper so `buyItem`/`throwItem`/`claimOwnItem` all
throw it specifically instead of a generic "try again" message that would
never actually help a non-allowlisted user. Covered in
`pileService.test.ts` (not-enrolled vs. a generic 403 with a different
body). Verified: full suite now 237/237 (2 new), `tsc --noEmit` still
clean.

**✅ Phase 3 — Buying / catalog (buy-only, as scoped)**. New
`app/components/wallet/PileMarketSection.tsx`, mounted inside
`WalletScreen.tsx` between "Actions" and "Recent Transactions" (the nav
decision from before Phase 0 started). Fetches `listMarketItems('hot', 0)`
(first page only — pagination/"load more" wasn't in scope for this pass)
as a horizontally scrolling row of cards (image, name, price, Buy button),
plus the viewer's live points balance via `pointsService.fetchPointsSummary`,
kept in sync with `onPointsSpent`/`onPointsEarned` so a vote award or a
throw's anonymous burn elsewhere in the app updates the number shown here
too. Handles every `buyItem` outcome (`purchased`, `already_purchased`,
`insufficient_balance`, `self_purchase`, `item_not_found` — the last one
also prunes the now-gone item from the visible list) plus `NotEnrolledError`,
same distinct message as Phase 2's throw flow. Renders nothing when logged
out. Creating new items and the creator-claim flow are out of scope (lower
priority than buy/throw, per the original call to ship buy-only first).
Verified: full suite still 237/237, `tsc --noEmit` still clean.

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

**Correction — buying your own item was broken.** `pileService.ts` already
had `claimOwnItem()` (a free unit for the creator of their own item,
distinct from a paid `buyItem()`), but `PileMarketSection.tsx` never called
it — every "Buy" press called `buyItem()` regardless of who created the
item, which the server correctly rejects as `self_purchase` for a
creator's own item. Caught by the user hitting a real purchase failure
with a sufficient balance. Fixed by porting snapie-io's market page
pattern exactly: `isOwnItem = currentUsername === item.creatorUsername`
computed per item, routing the button to `handleClaim` (free) instead of
`handleBuy` (paid) when true, with the button label/price display
reflecting it ("Claim" / "Free (yours)" vs "Buy" / "N pts"). Also added
balance-aware disabling ("Need more" when the shown balance can't cover
the price) — snapie-io's page does this too and HiveSnaps' didn't before.

## 💤 CI/CD pipeline (noted, no action yet)

Set up CI/CD for HiveSnaps. Must include: building an APK and uploading it
to a GitHub Release (or similar), so people who don't want to go through the
Play Store/App Store can still install directly. Not scoped or started —
revisit when we're ready to design the pipeline (build matrix, signing,
release triggers, where EAS Build fits given `eas.json` already exists in
the repo).
