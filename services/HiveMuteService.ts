// HiveMuteService.ts
// Service for fetching the muted list from HAFSQL API and combining it with the global blacklist

import { BlacklistService } from './BlacklistService';
import { makeAuthenticatedRequest } from './AuthenticatedRequest';

// Define interfaces for the expected API response and muted user objects
interface MutedUserObject {
  account?: string;
  username?: string;
}
type MutedApiResponse = string[] | { muted: (string | MutedUserObject)[] };

export async function fetchMutedList(username: string): Promise<Set<string>> {
  if (!username) return new Set();

  try {
    console.log('[HiveMuteService] 🚀 Starting fetch for user:', username);

    // Fetch both user's personal muted list and global blacklist in parallel
    const [personalMuted, globalBlacklist] = await Promise.all([
      fetchPersonalMutedList(),
      BlacklistService.getBlacklist()
    ]);

    // Log each list separately for debugging
    console.log('[HiveMuteService] 👤 PERSONAL MUTED USERS (' + personalMuted.length + '):', personalMuted);
    console.log('[HiveMuteService] 🚫 GLOBAL BLACKLISTED USERS (' + globalBlacklist.length + '):', globalBlacklist);

    // Combine both lists
    const combinedMuted = new Set([...personalMuted, ...globalBlacklist]);
    const combinedArray = Array.from(combinedMuted);

    console.log('[HiveMuteService] 🔗 FINAL COMBINED LIST (' + combinedMuted.size + '):', combinedArray);
    console.log('[HiveMuteService] ✅ Summary:', {
      personal: personalMuted.length,
      blacklist: globalBlacklist.length,
      total: combinedMuted.size,
      includes_mutethisuser: combinedMuted.has('mutethisuser')
    });

    return combinedMuted;
  } catch (err) {
    console.error('[HiveMuteService] ❌ Error fetching combined muted list:', err);
    return new Set();
  }
}

/**
 * Fetch only the user's personal muted list from HAFSQL API
 */
async function fetchPersonalMutedList(): Promise<string[]> {
  const response = await makeAuthenticatedRequest({
    path: '/muted/',
    method: 'GET',
    shouldCache: true, // Enable networking layer caching
    timeoutMs: 10000,
    retries: 2
  });
  const data: MutedApiResponse = response.body;
  console.log('[HiveMuteService] Fetched personal muted data:', data);
  // The API returns an array of usernames in the 'muted' field or as the root array
  const muted = Array.isArray(data)
    ? data
    : [];
  return muted;
}
