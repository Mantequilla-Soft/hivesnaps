/**
 * Route external image URLs through the Hive image proxy.
 *
 * This prevents the device from making direct HTTP requests to arbitrary
 * third-party servers embedded in snap content, which would expose the user's
 * IP address and device info (tracking pixel attack).
 *
 * Format: https://images.hive.blog/0x0/{originalUrl}
 * "0x0" means return the image at its original dimensions.
 */
const HIVE_IMAGE_PROXY = 'https://images.hive.blog/0x0/';
const PROXY_PREFIXES = [
    'https://images.hive.blog/',
    'https://images.ecency.com/',
];

export function proxyImageUrl(url: string): string {
    if (!url) return url;
    // Don't proxy data URIs (inline images)
    if (url.startsWith('data:')) return url;
    // Parse the URL so scheme normalization is handled by the runtime (case-insensitive).
    // Malformed URLs (relative paths, protocol-relative, etc.) throw and are returned as-is.
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }
    // Only proxy HTTP(S) — file://, javascript:, blob:, etc. pass through unchanged
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
    // Already proxied — don't double-wrap (compare against normalised href)
    if (PROXY_PREFIXES.some((p) => parsed.href.startsWith(p))) return parsed.href;
    return `${HIVE_IMAGE_PROXY}${parsed.href}`;
}
