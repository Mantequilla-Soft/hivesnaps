/** json_metadata arrives as a raw JSON string (condenser/database API) or an
 *  already-parsed object (bridge API), depending on which RPC fetched it. */
type JsonMetadata = string | Record<string, unknown> | null | undefined;

/** Canonical form of a hashtag: no leading '#', trimmed, lowercase. Used by
 *  both the tag editor and the matcher so they can never disagree. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').toLowerCase();
}

/** True when the metadata's `tags` include any of `mutedTags`. Never throws:
 *  malformed/missing metadata or an empty mute list just means "not muted". */
export function hasMutedTag(jsonMetadata: JsonMetadata, mutedTags: string[]): boolean {
  if (!jsonMetadata || mutedTags.length === 0) return false;

  let parsed: any;
  try {
    parsed = typeof jsonMetadata === 'string' ? JSON.parse(jsonMetadata) : jsonMetadata;
  } catch {
    return false;
  }
  if (!Array.isArray(parsed?.tags)) return false;

  const muted = new Set(mutedTags.map(normalizeTag));
  return parsed.tags.some((t: unknown) => muted.has(normalizeTag(String(t))));
}
