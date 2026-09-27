// HiveMuteService.ts
//
// Fetches muted accounts directly from Hive's own bridge API — both the
// HiveSnaps community's muted/moderated members and the viewer's personal
// mute (native follow/ignore) list — instead of HiveSnaps' own backend.
// Mirrors snapie-io's mutedAccountsManager: union both on-chain sources,
// cache the result for 24h (in-memory, per-username), and fall back to
// stale cached data instead of an empty set when a fetch fails, so a flaky
// network moment doesn't silently turn filtering off.

import { getClient } from './HiveClient';

// Kept as its own constant rather than importing hooks/useBlogFeed's
// SNAPIE_COMMUNITY — that file pulls in AvatarService (and transitively
// AsyncStorage), which this pure data-fetching service has no other reason
// to depend on. Same string other call sites already hardcode (e.g.
// useCompose.ts's blog-post tags).
const SNAPIE_COMMUNITY = 'hive-178315';

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedMutedList {
  accounts: string[];
  timestamp: number;
}

const cache = new Map<string, CachedMutedList>();
const inFlight = new Map<string, Promise<Set<string>>>();
// True if the most recent fetchMutedList call for this user hit the catch
// branch below (a bridge call failed). Callers that persist the result into
// a longer-lived outer cache (e.g. the app store's 24h MUTED_LIST cache)
// should use a short retry lifetime instead when this is true, so a
// connectivity blip doesn't block muting for a full day.
const lastFetchFailed = new Map<string, boolean>();
// Bumped by clearMutedListCache. A fetch captures the epoch it started
// with and only writes to `cache` if it's still current — otherwise a
// mute/unmute that lands mid-fetch can't have its own invalidation undone
// by that now-stale fetch resolving afterward.
const epoch = new Map<string, number>();

type CommunityRoleEntry = [account: string, role: string, title?: string];

const COMMUNITY_ROLES_PAGE_SIZE = 1000;

async function fetchCommunityMutedList(): Promise<string[]> {
  const client = getClient();
  const muted: string[] = [];
  let last = '';

  // bridge.list_community_roles only returns one page per call — page
  // through with `last` until a short page tells us we've reached the end,
  // so a community with >1000 role entries doesn't silently lose the rest.
  for (;;) {
    const roles = (await client.call('bridge', 'list_community_roles', {
      community: SNAPIE_COMMUNITY,
      last,
      limit: COMMUNITY_ROLES_PAGE_SIZE,
    })) as CommunityRoleEntry[] | null;
    const page = roles ?? [];

    for (const entry of page) {
      if (entry[1] === 'muted') muted.push(entry[0]);
    }

    if (page.length < COMMUNITY_ROLES_PAGE_SIZE) break;
    last = page[page.length - 1][0];
  }

  return muted;
}

async function fetchPersonalMutedList(username: string): Promise<string[]> {
  const client = getClient();
  const entries = (await client.call('bridge', 'get_follow_list', {
    observer: username,
    follow_type: 'muted',
  })) as { name: string }[] | null;
  return (entries ?? []).map(entry => entry.name);
}

/**
 * Returns the union of community-muted and personally-muted (Hive native
 * follow/ignore) accounts, lowercased. Never throws — any fetch failure
 * resolves to the last known cached result, or an empty Set if nothing has
 * ever been cached for this user.
 */
export async function fetchMutedList(username: string): Promise<Set<string>> {
  if (!username) return new Set();

  const key = username.toLowerCase();

  const existingFetch = inFlight.get(key);
  if (existingFetch) return existingFetch;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return new Set(cached.accounts);
  }

  const startEpoch = epoch.get(key) ?? 0;

  const fetchPromise = (async (): Promise<Set<string>> => {
    try {
      // Settle independently — one source rejecting shouldn't discard the
      // other's result the way Promise.all would.
      const [communityResult, personalResult] = await Promise.allSettled([
        fetchCommunityMutedList(),
        fetchPersonalMutedList(username),
      ]);

      if (communityResult.status === 'rejected' && personalResult.status === 'rejected') {
        throw communityResult.reason;
      }
      if (communityResult.status === 'rejected') {
        console.error('[HiveMuteService] Community-muted fetch failed:', communityResult.reason);
      }
      if (personalResult.status === 'rejected') {
        console.error('[HiveMuteService] Personal-muted fetch failed:', personalResult.reason);
      }

      const communityMuted = communityResult.status === 'fulfilled' ? communityResult.value : [];
      const personalMuted = personalResult.status === 'fulfilled' ? personalResult.value : [];

      const accounts = Array.from(
        new Set([...communityMuted, ...personalMuted].map(a => a.toLowerCase()))
      );

      if ((epoch.get(key) ?? 0) === startEpoch) {
        cache.set(key, { accounts, timestamp: Date.now() });
        lastFetchFailed.delete(key);
      }
      return new Set(accounts);
    } catch (err) {
      console.error('[HiveMuteService] Error fetching muted list, falling back to cache:', err);
      lastFetchFailed.set(key, true);
      // Fail closed: prefer stale cached data over an empty set, so a
      // flaky/offline moment doesn't silently disable muting.
      return cached ? new Set(cached.accounts) : new Set();
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, fetchPromise);
  return fetchPromise;
}

/** True if the most recent fetchMutedList call for `username` failed and
 *  fell back to stale/empty data. See `lastFetchFailed` above. */
export function didLastMutedListFetchFail(username: string): boolean {
  return lastFetchFailed.get(username.toLowerCase()) ?? false;
}

/** Clears the cached muted list for a user, forcing the next
 *  fetchMutedList call to hit the network. Call after a mute/unmute. */
export function clearMutedListCache(username: string): void {
  const key = username.toLowerCase();
  cache.delete(key);
  // Bump the epoch so a fetch already in flight (started before this
  // mute/unmute) can't repopulate the cache with pre-change data once it
  // resolves. Also drop the in-flight entry itself so the next caller
  // starts a fresh fetch instead of awaiting that stale one.
  epoch.set(key, (epoch.get(key) ?? 0) + 1);
  inFlight.delete(key);
}
