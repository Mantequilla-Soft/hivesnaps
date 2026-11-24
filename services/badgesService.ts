// PeakD-style account badges: a `badge-XXXXXX` Hive account "follows" every
// holder of that badge, and its own profile supplies the badge's name,
// description and icon. Working that out takes hundreds of Hive calls, so
// snapie.io builds the index server-side (cached for a day) and serves it
// per user; the app reads that same public endpoint, like points.

const SNAPIE_API_URL = 'https://snapie.io';
const FETCH_TIMEOUT_MS = 10_000;
/** The endpoint itself is cached for an hour; no point asking more often. */
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface AccountBadge {
    /** The badge's own Hive account, e.g. "badge-500503". */
    account: string;
    name: string;
    about: string;
    /** Icon URL (any host — show it through the image proxy). */
    image: string;
}

const cache = new Map<string, { at: number; badges: AccountBadge[] }>();

function isBadge(b: unknown): b is AccountBadge {
    if (!b || typeof b !== 'object') return false;
    const x = b as Record<string, unknown>;
    return (
        typeof x.account === 'string' &&
        x.account.startsWith('badge-') &&
        typeof x.name === 'string' &&
        typeof x.about === 'string' &&
        typeof x.image === 'string' &&
        x.image !== ''
    );
}

/**
 * The badges `username` holds. Badges are decorative, so any failure resolves
 * to an empty list (and isn't cached, so the next profile visit retries).
 */
export async function fetchAccountBadges(username: string): Promise<AccountBadge[]> {
    const key = username.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.badges;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(`${SNAPIE_API_URL}/api/badges/${encodeURIComponent(key)}`, { signal: controller.signal });
        if (!res.ok) return [];
        const data = (await res.json()) as { badges?: unknown };
        const badges = Array.isArray(data.badges) ? data.badges.filter(isBadge) : [];
        cache.set(key, { at: Date.now(), badges });
        return badges;
    } catch (err) {
        console.warn('[badgesService] could not load badges:', err);
        return [];
    } finally {
        clearTimeout(timer);
    }
}

/** PeakD's page for a badge (who holds it, how to get it). */
export const badgePageUrl = (badgeAccount: string): string => `https://peakd.com/b/${encodeURIComponent(badgeAccount)}`;

/** For tests. */
export function clearBadgeCache(): void {
    cache.clear();
}
