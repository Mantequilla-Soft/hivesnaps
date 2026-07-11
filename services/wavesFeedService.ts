// Pulls "waves" (short-form Ecency content) out of snapie.io's blended
// /api/feed sidecar. Snap items in that same payload are intentionally
// discarded — HiveSnaps already has a richer, native-Hive source for those.

const FEED_URL = 'https://snapie.io/api/feed';
const PAGE_LIMIT = 20;
const FETCH_TIMEOUT_MS = 10_000;
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000; // backoff after a failure
const THIN_PAGE_THRESHOLD = 5; // fetch another page if fewer waves than this
const MAX_FOLLOWUP_PAGES = 2; // hard cap so a wave-sparse stream can't loop forever

interface SidecarFeedItem {
  source: 'snap' | 'wave';
  author: string;
  permlink: string;
  created: string;
  parentAuthor?: string;
  parentPermlink?: string;
  body?: string;
  json_metadata?: string;
  active_votes?: Array<{ voter: string; percent: number }>;
  children?: number;
}

interface SidecarFeedResponse {
  items: SidecarFeedItem[];
  hasMore: boolean;
}

export interface WaveItem {
  author: string;
  permlink: string;
  created: string;
  parentAuthor?: string;
  parentPermlink?: string;
  body?: string;
  json_metadata?: string;
  active_votes?: Array<{ voter: string; percent: number }>;
  children?: number;
}

export interface FetchWaveItemsResult {
  waves: WaveItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

let cooldownUntil = 0;

function toWaveItem(item: SidecarFeedItem): WaveItem {
  return {
    author: item.author,
    permlink: item.permlink,
    created: item.created,
    parentAuthor: item.parentAuthor,
    parentPermlink: item.parentPermlink,
    body: item.body,
    json_metadata: item.json_metadata,
    active_votes: item.active_votes,
    children: item.children,
  };
}

async function fetchPage(before?: string): Promise<SidecarFeedResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const params = new URLSearchParams({ limit: PAGE_LIMIT.toString() });
  if (before) params.set('before', before);

  try {
    const res = await fetch(`${FEED_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Waves feed fetch failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as SidecarFeedResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches waves starting from `before` (a `created` timestamp cursor, or
 * omitted for the newest page). Follows up with a bounded number of extra
 * pages if the wave yield on a page is thin, so callers don't have to
 * re-implement "keep paging until I have enough" themselves.
 */
export async function fetchWaveItems(before?: string): Promise<FetchWaveItemsResult> {
  if (Date.now() < cooldownUntil) {
    return { waves: [], nextCursor: null, hasMore: false };
  }

  try {
    let cursor = before;
    let waves: WaveItem[] = [];
    let hasMore = true;
    let pagesFetched = 0;

    do {
      const page = await fetchPage(cursor);
      pagesFetched += 1;

      const pageWaves = page.items
        .filter(item => item.source === 'wave')
        .map(toWaveItem);
      waves = waves.concat(pageWaves);
      hasMore = page.hasMore;

      const lastItem = page.items[page.items.length - 1];
      cursor = lastItem ? lastItem.created : cursor;

      if (page.items.length === 0) {
        // An empty page means nothing left to page through, regardless of what
        // the server's own hasMore claimed — don't let callers keep paginating.
        hasMore = false;
        break;
      }
    } while (waves.length < THIN_PAGE_THRESHOLD && hasMore && pagesFetched <= MAX_FOLLOWUP_PAGES);

    return {
      waves,
      nextCursor: hasMore ? cursor ?? null : null,
      hasMore,
    };
  } catch (error) {
    console.error('[wavesFeedService] Error fetching waves feed:', error);
    cooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return { waves: [], nextCursor: null, hasMore: false };
  }
}
