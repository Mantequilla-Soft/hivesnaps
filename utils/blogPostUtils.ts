/**
 * Helpers for building a Hive root post (blog) from composer input, as
 * opposed to a snap (which is always a reply nested under a container post
 * and never needs a permlink derived from a title).
 */

/**
 * Slugifies a title into a Hive-valid permlink. Titles aren't unique across
 * posts (nor across time, if a user reuses one), so a timestamp suffix is
 * appended to keep the permlink unique.
 */
export function generatePostPermlink(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Date.now().toString().slice(-6);
  return base ? `${base}-${suffix}` : `post-${suffix}`;
}

/**
 * Parses free-form tag input (space/comma separated, optionally #-prefixed)
 * into deduped, lowercase, Hive-valid tags. Hive tags may only contain
 * lowercase letters, numbers, and hyphens.
 */
export function parseHiveTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,#]+/)
        .map(tag => tag.toLowerCase().replace(/[^a-z0-9-]/g, ''))
        .filter(Boolean)
    )
  );
}
