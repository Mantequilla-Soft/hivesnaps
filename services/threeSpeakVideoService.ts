/**
 * Service for fetching 3Speak video metadata from the Snapie Player API.
 *
 * The API returns fully-resolved HTTPS URLs — no CID conversion needed on the
 * client side. The server handles all gateway logic plus video state (processing,
 * deleted, failed) by returning appropriate placeholder CIDs automatically.
 *
 * Endpoints:
 *   /api/watch?v=owner/permlink&info=true  → legacy web recorder videos
 *   /api/embed?v=owner/permlink&info=true  → snapie mobile uploads
 */

const SNAPIE_BASE_URL = 'https://play.3speak.tv';

export interface ThreeSpeakVideoInfo {
    /** Full HTTPS URL to HLS manifest (e.g. https://hotipfs.../manifest.m3u8). Pass directly to Video source. */
    cid: string;
    /** Full HTTPS URL to thumbnail image. Pass directly to Image source. */
    thumbnail: string;
    /** Current view count. */
    views: number;
    /** Embed videos only — true if short-form format. */
    short?: boolean;
}

/**
 * Builds the Snapie API info URL from a detected 3Speak embedUrl or originalUrl.
 *
 * Handles all URL forms produced by extractVideoInfo.ts:
 *   https://play.3speak.tv/watch?v=user/id
 *   https://play.3speak.tv/embed?v=user/id
 *
 * Converts to API endpoint and appends &info=true:
 *   https://play.3speak.tv/api/watch?v=user/id&info=true
 *   https://play.3speak.tv/api/embed?v=user/id&info=true
 */
export function buildInfoUrl(embedUrl: string): string | null {
    try {
        const parsed = new URL(embedUrl);

        // Exact allowlist — .includes() would pass 'evil.3speak.tv.attacker.com'
        const ALLOWED_HOSTNAMES = new Set(['play.3speak.tv', '3speak.tv', '3speak.online']);
        if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
            return null;
        }

        const path = parsed.pathname; // /watch or /embed
        if (!path.includes('/watch') && !path.includes('/embed')) {
            return null;
        }

        const v = parsed.searchParams.get('v');
        if (!v) {
            return null;
        }

        // v is 'owner/permlink' — encode each segment separately so the
        // structural slash is preserved. encodeURIComponent('/') → '%2F'
        // which some server configs treat differently, causing silent 404s.
        const [owner, permlink] = v.split('/');
        if (!owner || !permlink) {
            return null;
        }

        // Determine the API endpoint based on the path
        const apiPath = path.includes('/watch') ? '/api/watch' : '/api/embed';

        // Construct API URL with info=true
        return `${SNAPIE_BASE_URL}${apiPath}?v=${encodeURIComponent(owner)}/${encodeURIComponent(permlink)}&info=true`;
    } catch {
        return null;
    }
}

/**
 * Fetches video metadata from the Snapie Player API.
 *
 * @param embedUrl - The embedUrl from VideoInfo (as returned by extractVideoInfo)
 * @returns Resolved video info, or null on any error (network, 404, 5xx, parse).
 */
export async function fetchThreeSpeakVideoInfo(
    embedUrl: string,
): Promise<ThreeSpeakVideoInfo | null> {
    const infoUrl = buildInfoUrl(embedUrl);
    if (!infoUrl) {
        console.warn('[threeSpeakVideoService] Could not build info URL from:', embedUrl);
        return null;
    }

    try {
        if (__DEV__) {
            console.log('[threeSpeakVideoService] Fetching from:', infoUrl);
        }

        const response = await fetch(infoUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            console.warn(
                `[threeSpeakVideoService] API returned ${response.status} for ${infoUrl}`,
            );
            return null;
        }

        const data = await response.json();

        if (__DEV__) {
            console.log('[threeSpeakVideoService] API response:', {
                cid: data?.cid,
                thumbnail: data?.thumbnail,
                views: data?.views,
                short: data?.short,
            });
        }

        if (!data?.cid || !data?.thumbnail) {
            console.warn('[threeSpeakVideoService] Unexpected response shape:', data);
            return null;
        }

        return {
            cid: data.cid as string,
            thumbnail: data.thumbnail as string,
            views: typeof data.views === 'number' ? data.views : 0,
            short: typeof data.short === 'boolean' ? data.short : undefined,
        };
    } catch (err) {
        console.warn('[threeSpeakVideoService] Fetch error:', err);
        return null;
    }
}
