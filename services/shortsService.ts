/**
 * Fetches HiveSnaps' Shorts feed from 3Speak's own aggregation API — the
 * same `checker.3speak.tv/shortssorted` endpoint snapie-io's Shorts page
 * reads from. This is a cross-app pool: any 3Speak client's `short: true`
 * upload shows up here, HiveSnaps' own included (every snap-composer video
 * upload is marked as a short by default — see hooks/useVideoUpload.ts).
 * There is no HiveSnaps backend or Hive bridge query involved in the list
 * itself; per-item Hive vote/comment counts are cross-referenced separately
 * (see fetchShortHiveStats) the same way snapie-io's short-meta route does.
 *
 * NOTE: this dev environment's network policy blocks outbound requests to
 * checker.3speak.tv, so the exact response envelope could not be verified
 * live while writing this — parsing below tolerates several plausible key
 * names/shapes (mirroring the defensive parsing the old BlacklistService
 * used to need). Smoke-test against the real endpoint before shipping and
 * tighten this if the actual shape turns out narrower.
 */

const CHECKER_URL = 'https://checker.3speak.tv/shortssorted';

export interface ShortItem {
  /** `${author}/${permlink}` — stable dedup/list key. */
  id: string;
  author: string;
  /** 3Speak's own video permlink — playback identity (embed/API URLs). */
  permlink: string;
  /** Hive post permlink — for votes/comments/share links. Usually the same
   *  value as `permlink`, but kept distinct since 3Speak's schema treats
   *  them as separate concepts. */
  hivePermlink: string;
  thumbnailUrl: string;
  title: string;
  views: number;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawShortEntry = Record<string, any>;

function firstString(entry: RawShortEntry, keys: string[]): string {
  for (const key of keys) {
    if (typeof entry[key] === 'string' && entry[key]) return entry[key];
  }
  return '';
}

function firstNumber(entry: RawShortEntry, keys: string[]): number {
  for (const key of keys) {
    if (typeof entry[key] === 'number') return entry[key];
  }
  return 0;
}

function parseEmbedUrl(embedUrl: string): { author: string; permlink: string } | null {
  try {
    const url = new URL(embedUrl);
    const v = url.searchParams.get('v');
    if (!v) return null;
    const [author, permlink] = v.split('/');
    if (!author || !permlink) return null;
    return { author, permlink };
  } catch {
    return null;
  }
}

function parseEntry(entry: RawShortEntry): ShortItem | null {
  const embedUrl = firstString(entry, ['embed_url', 'embedUrl', 'embed', 'video_url']);
  if (!embedUrl) return null;

  const parsed = parseEmbedUrl(embedUrl);
  if (!parsed) return null;

  const permlink = firstString(entry, ['permlink', 'video_permlink']) || parsed.permlink;

  return {
    id: `${parsed.author}/${permlink}`,
    author: parsed.author,
    permlink,
    hivePermlink: firstString(entry, ['hive_permlink', 'permlink']) || parsed.permlink,
    thumbnailUrl: firstString(entry, ['thumbnail_url', 'thumbnailUrl', 'thumbnail']),
    title: firstString(entry, ['hive_title', 'embed_title', 'title']),
    views: firstNumber(entry, ['views', 'view_count']),
    createdAt: firstString(entry, ['createdAt', 'created_at', 'created']),
  };
}

function extractRawEntries(data: unknown): RawShortEntry[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['shorts', 'items', 'results', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as RawShortEntry[];
    }
  }
  return [];
}

function extractPageInfo(data: unknown, requestedPage: number): { page: number; hasMore: boolean } {
  if (!data || typeof data !== 'object') return { page: requestedPage, hasMore: false };
  const obj = data as Record<string, unknown>;
  const page = typeof obj.page === 'number' ? obj.page : requestedPage;
  const totalPages = typeof obj.totalPages === 'number' ? obj.totalPages : undefined;
  const hasMore = typeof totalPages === 'number' ? page < totalPages : extractRawEntries(data).length > 0;
  return { page, hasMore };
}

export interface FetchShortsPageResult {
  items: ShortItem[];
  hasMore: boolean;
}

/**
 * Fetches one page of the global Shorts pool. `seed` should stay constant
 * across pages within a single feed session (so pagination is stable) and
 * change on a fresh pull-to-refresh (so the shuffled order varies), same as
 * snapie-io's own usage.
 */
export async function fetchShortsPage(
  page: number,
  seed: string,
  limit: number = 10
): Promise<FetchShortsPageResult> {
  const url = `${CHECKER_URL}?page=${page}&limit=${limit}&seed=${encodeURIComponent(seed)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Shorts request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawEntries = extractRawEntries(data);
  const items = rawEntries
    .map(parseEntry)
    .filter((item): item is ShortItem => item !== null);
  const { hasMore } = extractPageInfo(data, page);

  return { items, hasMore };
}
