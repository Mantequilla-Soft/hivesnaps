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

type CommunityRoleEntry = [account: string, role: string, title?: string];

async function fetchCommunityMutedList(): Promise<string[]> {
  const client = getClient();
  const roles = (await client.call('bridge', 'list_community_roles', {
    community: SNAPIE_COMMUNITY,
    limit: 1000,
  })) as CommunityRoleEntry[] | null;
  return (roles ?? [])
    .filter(entry => entry[1] === 'muted')
    .map(entry => entry[0]);
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

  const fetchPromise = (async (): Promise<Set<string>> => {
    try {
      const [communityMuted, personalMuted] = await Promise.all([
        fetchCommunityMutedList(),
        fetchPersonalMutedList(username),
      ]);

      const accounts = Array.from(
        new Set([...communityMuted, ...personalMuted].map(a => a.toLowerCase()))
      );

      cache.set(key, { accounts, timestamp: Date.now() });
      return new Set(accounts);
    } catch (err) {
      console.error('[HiveMuteService] Error fetching muted list, falling back to cache:', err);
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

/** Clears the cached muted list for a user, forcing the next
 *  fetchMutedList call to hit the network. Call after a mute/unmute. */
export function clearMutedListCache(username: string): void {
  cache.delete(username.toLowerCase());
}
