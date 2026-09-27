/**
 * Fetches HiveSnaps' Shorts feed from 3Speak's own aggregation API — the
 * same `checker.3speak.tv/shortssorted` endpoint snapie-io's Shorts page
 * reads from. This is a cross-app pool: any 3Speak client's `short: true`
 * upload shows up here, HiveSnaps' own included (every snap-composer video
 * upload is marked as a short by default — see hooks/useVideoUpload.ts).
 * There is no HiveSnaps backend or Hive bridge query involved in the list
 * itself; per-item Hive vote/comment counts are cross-referenced separately,
 * the same way snapie-io's short-meta route does.
 *
 * Parsing here is deliberately a close mirror of snapie-io's own
 * hooks/useShorts.ts (fetchPage/parseEmbedUrl), confirmed against its
 * actual source rather than guessed — a first pass here assumed `embed_url`
 * was a full `https://play.3speak.tv/embed?v=...` URL and parsed it with
 * `new URL()`, which throws on the real API's bare `"author/permlink"`
 * string and silently dropped every entry. Fixed to match: split on the
 * first `/`, no URL parsing.
 */

const CHECKER_URL = 'https://checker.3speak.tv/shortssorted';
const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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

/**
 * `embed_url` in the real API response is a bare "author/permlink" string
 * (optionally `@`-prefixed), NOT a full URL — mirrors snapie-io's own
 * parseEmbedUrl exactly (split on the first slash, no URL/query parsing).
 */
function parseEmbedUrl(embedUrl: string): { author: string; permlink: string } {
  const cleaned = embedUrl.replace(/^@/, '');
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx === -1) return { author: cleaned, permlink: '' };
  return { author: cleaned.slice(0, slashIdx), permlink: cleaned.slice(slashIdx + 1) };
}

function parseEntry(entry: RawShortEntry): ShortItem | null {
  const embedUrl = firstString(entry, ['embed_url', 'embedUrl', 'embed', 'video_url']);
  const { author: embedAuthor, permlink: embedHivePermlink } = parseEmbedUrl(embedUrl);

  // snapie-io falls back to a top-level `owner` field if embed_url didn't
  // yield an author (e.g. missing/malformed entry).
  const author = embedAuthor || firstString(entry, ['owner']);
  if (!author) return null;

  // The 3Speak video permlink (playback identity) is its own top-level
  // field — distinct from the Hive post permlink parsed out of embed_url
  // above, though they're usually the same value in practice.
  const permlink = firstString(entry, ['permlink', 'video_permlink']);
  if (!permlink) return null;

  return {
    id: `${author}/${permlink}`,
    author,
    permlink,
    hivePermlink: embedHivePermlink || permlink,
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

/**
 * Matches snapie-io's own `(data.page ?? 1) < (data.totalPages ?? 1)`
 * exactly — confirmed field names from its source, not guessed.
 */
function extractHasMore(data: unknown): boolean {
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const page = typeof obj.page === 'number' ? obj.page : 1;
  const totalPages = typeof obj.totalPages === 'number' ? obj.totalPages : 1;
  return page < totalPages;
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
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Shorts request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawEntries = extractRawEntries(data);
  const items = rawEntries
    .map(parseEntry)
    .filter((item): item is ShortItem => item !== null);
  const hasMore = extractHasMore(data);

  return { items, hasMore };
}
