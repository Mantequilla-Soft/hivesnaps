import { getClient } from './HiveClient';
import { isValidHiveUsername } from '../utils/hiveUsername';

/**
 * Cached Hive username lookups for @mention autocomplete and checking,
 * like snapie.io's lib/hive/usernameLookup.ts. Two questions, two calls:
 * - "what could this partial be?" → condenser_api.lookup_accounts (prefix)
 * - "is this exact name real?"    → get_accounts (batched)
 */

const prefixCache = new Map<string, string[]>();
/** Prefixes whose cached list is complete (fewer than asked came back). */
const completePrefixes = new Set<string>();
const valid = new Set<string>();
const invalid = new Set<string>();

/** Hive's shortest username; nothing shorter can match. */
export const MIN_MENTION_QUERY = 3;

function longestCompletePrefixOf(prefix: string): string | null {
    for (let len = prefix.length - 1; len >= MIN_MENTION_QUERY; len--) {
        const candidate = prefix.slice(0, len);
        if (completePrefixes.has(candidate)) return candidate;
    }
    return null;
}

/** Up to `limit` usernames starting with `prefix`; [] under 3 characters or on failure. */
export async function searchUsernamesByPrefix(prefix: string, limit = 8): Promise<string[]> {
    const p = prefix.trim().toLowerCase();
    if (p.length < MIN_MENTION_QUERY) return [];
    const cached = prefixCache.get(p);
    if (cached) return cached.slice(0, limit);

    // A shorter prefix already returned everything there is: filter it locally.
    const base = longestCompletePrefixOf(p);
    if (base) {
        const filtered = prefixCache.get(base)!.filter((name) => name.startsWith(p));
        prefixCache.set(p, filtered);
        completePrefixes.add(p);
        return filtered.slice(0, limit);
    }

    try {
        const raw: unknown = await getClient().call('condenser_api', 'lookup_accounts', [p, limit]);
        // lookup_accounts returns names from `p` onward alphabetically, not only matches.
        const results = (Array.isArray(raw) ? raw : []).filter(
            (name): name is string => typeof name === 'string' && name.startsWith(p)
        );
        prefixCache.set(p, results);
        if (results.length < limit) completePrefixes.add(p);
        results.forEach((name) => valid.add(name));
        return results;
    } catch {
        return [];
    }
}

/**
 * Which of `names` are real accounts. Only asks about names not already
 * known (picking a suggestion makes it known, so that costs nothing).
 * Names that can't be Hive usernames count as not real without a request.
 */
export async function validateUsernames(names: readonly string[]): Promise<Set<string>> {
    const distinct = Array.from(new Set(names.map((n) => n.toLowerCase()))).filter(Boolean);
    for (const n of distinct) if (!isValidHiveUsername(n)) invalid.add(n);
    const unknown = distinct.filter((n) => !valid.has(n) && !invalid.has(n));
    if (unknown.length > 0) {
        try {
            const accounts = await getClient().database.getAccounts(unknown);
            const found = new Set(accounts.map((a) => a.name));
            for (const n of unknown) (found.has(n) ? valid : invalid).add(n);
        } catch {
            // Leave them unresolved rather than guess.
        }
    }
    return new Set(distinct.filter((n) => valid.has(n)));
}

/** true / false if already known, null if not checked yet. */
export function getKnownValidity(name: string): boolean | null {
    const n = name.toLowerCase();
    if (valid.has(n)) return true;
    if (invalid.has(n)) return false;
    return null;
}

/** For tests. */
export function clearUsernameLookupCache(): void {
    prefixCache.clear();
    completePrefixes.clear();
    valid.clear();
    invalid.clear();
}
