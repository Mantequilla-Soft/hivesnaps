/**
 * Mood Badges (snapie.io): a small badge people buy with Snapie Points and
 * equip, shown next to their avatar ("@meno is feeling sleepy").
 *
 * snapie.io serves every equipped badge in one public map
 * (GET /api/mood-badges/equipped → { "meno": "sleepy", ... }), so the app
 * fetches it once and shares it, the same way as patron tiers.
 */
const EQUIPPED_URL = 'https://snapie.io/api/mood-badges/equipped';
const IMAGE_BASE = 'https://snapie.io/badges/';
// The server caches the map for 2 minutes; a few minutes here keeps a
// freshly equipped badge from taking long to show up.
const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export type MoodBadgeSku = 'bull' | 'bear' | 'excited' | 'sleepy' | 'salty' | 'grouchy' | 'caffeinated' | 'amused';

/** How each mood reads in "@user is feeling ___" (matches snapie.io). */
export const MOOD_BADGE_FEELING: Record<MoodBadgeSku, string> = {
  bull: 'bullish',
  bear: 'bearish',
  excited: 'excited',
  sleepy: 'sleepy',
  salty: 'salty',
  grouchy: 'grouchy',
  caffeinated: 'caffeinated',
  amused: 'amused',
};

/** For screen readers: "feeling sleepy". */
export function moodSpoken(sku: MoodBadgeSku): string {
  return `feeling ${MOOD_BADGE_FEELING[sku]}`;
}

export function isMoodBadgeSku(value: unknown): value is MoodBadgeSku {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MOOD_BADGE_FEELING, value);
}

/**
 * The badge image, resized by Ecency's image proxy: the originals are up to
 * 1.5 MB, far too big for an icon this size. (images.hive.blog refuses
 * these images.) `px` is the size in pixels.
 */
export function moodBadgeImageUrl(sku: MoodBadgeSku, px = 64): string {
  return `https://images.ecency.com/${px}x${px}/${IMAGE_BASE}${sku}.png`;
}

let cachedMap: Map<string, MoodBadgeSku> | null = null;
let cacheExpiry = 0;
let inflight: Promise<Map<string, MoodBadgeSku>> | null = null;

async function fetchEquipped(): Promise<Map<string, MoodBadgeSku>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(EQUIPPED_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Mood badges fetch failed: ${res.status}`);
    const data: unknown = await res.json();
    const map = new Map<string, MoodBadgeSku>();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [account, sku] of Object.entries(data as Record<string, unknown>)) {
        // Unknown moods (added on snapie.io after this release) are skipped
        // rather than shown as a broken image.
        if (isMoodBadgeSku(sku)) map.set(account.toLowerCase(), sku);
      }
    }
    return map;
  } finally {
    clearTimeout(timer);
  }
}

function loadEquipped(): Promise<Map<string, MoodBadgeSku>> {
  if (cachedMap && Date.now() < cacheExpiry) return Promise.resolve(cachedMap);
  if (inflight) return inflight;

  inflight = fetchEquipped()
    .then(map => {
      cachedMap = map;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      inflight = null;
      return map;
    })
    .catch(() => {
      inflight = null;
      // Keep showing what we had; retry in a few minutes.
      cachedMap ??= new Map<string, MoodBadgeSku>();
      cacheExpiry = Date.now() + ERROR_RETRY_TTL_MS;
      return cachedMap;
    });

  return inflight;
}

/** The account's equipped mood badge, or null. */
export async function getMoodBadge(account: string): Promise<MoodBadgeSku | null> {
  const map = await loadEquipped();
  return map.get(account.toLowerCase()) ?? null;
}

/** Synchronous peek at the cache, for a first render without a flash. */
export function getCachedMoodBadge(account: string): MoodBadgeSku | null {
  return cachedMap?.get(account.toLowerCase()) ?? null;
}

/** Tests only. */
export function resetMoodBadgeCacheForTests(): void {
  cachedMap = null;
  cacheExpiry = 0;
  inflight = null;
}
