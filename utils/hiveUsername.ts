import { getClient } from '../services/HiveClient';

// Hive username validation regex: 3-16 characters, starts with letter, ends with letter/number, allows dots and hyphens
// Dots are intentionally permitted to support legacy Hive accounts (e.g. smooth.witness).
// New account registrations cannot use dots, but existing accounts with dots must remain valid.
export const HIVE_USERNAME_REGEX = /^[a-z][a-z0-9\-.]{1,14}[a-z0-9]$/;

/** "@Foo " → "foo": lowercased, trimmed, without a leading @. */
export function normalizeUsername(input: string): string {
    return input.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHiveUsername(name: string): boolean {
    return HIVE_USERNAME_REGEX.test(name);
}

/**
 * Whether a (normalized) account exists on chain. Names that can't be Hive
 * accounts resolve false without a request (nodes throw for over-long names).
 * Network errors reject, so callers can tell "no such account" from "couldn't check".
 */
export async function hiveAccountExists(name: string): Promise<boolean> {
    if (!isValidHiveUsername(name)) return false;
    const accounts = await getClient().database.getAccounts([name]);
    return accounts.length > 0;
}
