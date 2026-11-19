// Hive username validation regex: 3-16 characters, starts with letter, ends with letter/number, allows dots and hyphens
// Dots are intentionally permitted to support legacy Hive accounts (e.g. smooth.witness).
// New account registrations cannot use dots, but existing accounts with dots must remain valid.
export const HIVE_USERNAME_REGEX = /^[a-z][a-z0-9\-.]{1,14}[a-z0-9]$/;

/** Lowercased, trimmed, without a leading @. */
export function normalizeUsername(input: string): string {
    return input.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHiveUsername(name: string): boolean {
    return HIVE_USERNAME_REGEX.test(name);
}
