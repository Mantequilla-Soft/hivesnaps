// Pulls comment-velocity-ranked "trending" snaps (and occasional resurrected
// "From the Vault" content, blended server-side) from snapie.io's discovery
// engine. Fetched once per feed session, not paginated — this is a fixed
// "what's hot right now" shelf, not a recurring stream.

import { Snap } from '../hooks/useFeedData';

const DISCOVERY_URL = 'https://snapie.io/api/discovery/snap-candidates';
const FETCH_TIMEOUT_MS = 10_000;
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000; // backoff after a failure
const LIMIT = 10;

export type DiscoveryReason = 'trending' | 'resurrected';

export type TrendingSnap = Snap & {
  isDiscovery: true;
  discoveryReason: DiscoveryReason;
};

interface DiscoveryResponse {
  items: TrendingSnap[];
  hasMore: boolean;
}

let cooldownUntil = 0;

export async function fetchTrendingSnaps(username?: string): Promise<TrendingSnap[]> {
  if (Date.now() < cooldownUntil) {
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const params = new URLSearchParams({ limit: LIMIT.toString(), offset: '0' });
  if (username) params.set('username', username);

  try {
    const res = await fetch(`${DISCOVERY_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Discovery feed fetch failed: ${res.status} ${res.statusText}`);
    }
    const data: DiscoveryResponse = await res.json();
    return data.items ?? [];
  } catch (error) {
    console.error('[discoveryService] Error fetching trending snaps:', error);
    cooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return [];
  } finally {
    clearTimeout(timer);
  }
}
