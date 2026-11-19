/**
 * Hive profile metadata: reading the editable fields from an account and
 * building the posting_json_metadata to broadcast, merged so nothing other
 * apps keep there (PeakD/Ecency settings, beneficiaries, tokens…) is lost.
 */

export interface ProfileFields {
    name: string;
    about: string;
    location: string;
    website: string;
    profile_image: string;
    cover_image: string;
}

export const EMPTY_PROFILE: ProfileFields = {
    name: '',
    about: '',
    location: '',
    website: '',
    profile_image: '',
    cover_image: '',
};

/** Lengths hivemind keeps; longer values get cut (or, for website, dropped) when profiles are indexed. */
export const PROFILE_LIMITS = { name: 20, about: 160, location: 30, website: 100 } as const;

interface AccountMetadata {
    posting_json_metadata?: string;
    json_metadata?: string;
}

type JsonObject = Record<string, unknown>;

function parseObject(raw: string | undefined): JsonObject | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : null;
    } catch {
        return null;
    }
}

function profileOf(meta: JsonObject | null): JsonObject | null {
    const profile = meta?.profile;
    return profile && typeof profile === 'object' && !Array.isArray(profile) ? (profile as JsonObject) : null;
}

/**
 * The profile other apps currently show: posting_json_metadata's when it has
 * one (that's what hivemind reads first), else the legacy json_metadata one.
 */
export function currentProfile(account: AccountMetadata): JsonObject {
    return profileOf(parseObject(account.posting_json_metadata)) ?? profileOf(parseObject(account.json_metadata)) ?? {};
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The editable fields of an account's current profile. */
export function readProfileFields(account: AccountMetadata): ProfileFields {
    const p = currentProfile(account);
    return {
        name: text(p.name),
        about: text(p.about),
        location: text(p.location),
        website: text(p.website),
        profile_image: text(p.profile_image),
        cover_image: text(p.cover_image),
    };
}

/**
 * "example.com" → "https://example.com"; "" stays "". Returns null when it
 * can't be a web address (hivemind drops websites that aren't http(s)).
 */
export function normalizeWebsite(input: string): string | null {
    const value = input.trim();
    if (!value) return '';
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    // A host with at least one dot, no spaces.
    if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$/i.test(withScheme)) return null;
    // A port, if any, must be a number in 1–65535. Checked by hand rather than
    // with URL: React Native's URL doesn't validate input the way Node's does.
    const host = /^https?:\/\/(?:[^\s/?#@]*@)?([^\s/?#]+)/i.exec(withScheme)?.[1] ?? '';
    const portSep = host.lastIndexOf(':');
    if (portSep !== -1) {
        const port = host.slice(portSep + 1);
        if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null;
    }
    return withScheme;
}

/** First problem with the edited fields, or null. */
export function profileFieldsError(fields: ProfileFields): string | null {
    if (fields.name.trim().length > PROFILE_LIMITS.name) return `Display name can be at most ${PROFILE_LIMITS.name} characters.`;
    if (fields.about.trim().length > PROFILE_LIMITS.about) return `About can be at most ${PROFILE_LIMITS.about} characters.`;
    if (fields.location.trim().length > PROFILE_LIMITS.location) return `Location can be at most ${PROFILE_LIMITS.location} characters.`;
    const website = normalizeWebsite(fields.website);
    if (website === null) return 'Website should be a web address, like example.com.';
    if (website.length > PROFILE_LIMITS.website) return `Website can be at most ${PROFILE_LIMITS.website} characters.`;
    return null;
}

/** Trimmed fields, website normalized. Call after profileFieldsError returns null. */
export function cleanProfileFields(fields: ProfileFields): ProfileFields {
    return {
        name: fields.name.trim(),
        about: fields.about.trim(),
        location: fields.location.trim(),
        website: normalizeWebsite(fields.website) ?? '',
        profile_image: fields.profile_image.trim(),
        cover_image: fields.cover_image.trim(),
    };
}

/**
 * The fields that differ from `baseline` (what the editor loaded), cleaned.
 * Saving only these keeps changes another app made since then.
 */
export function changedProfileFields(baseline: ProfileFields, edited: ProfileFields): Partial<ProfileFields> {
    const cleaned = cleanProfileFields(edited);
    const patch: Partial<ProfileFields> = {};
    for (const key of Object.keys(cleaned) as (keyof ProfileFields)[]) {
        if (edited[key] !== baseline[key]) patch[key] = cleaned[key];
    }
    return patch;
}

/**
 * posting_json_metadata with the edited fields applied: every other key —
 * at the top level and inside `profile` — is kept as it is on chain. If the
 * account has no posting profile yet, the legacy json_metadata profile is
 * the starting point so its fields aren't lost.
 */
export function buildPostingJsonMetadata(account: AccountMetadata, fields: Partial<ProfileFields>): string {
    const posting = parseObject(account.posting_json_metadata) ?? {};
    const profile: JsonObject = { ...currentProfile(account), ...fields, version: 2 };
    return JSON.stringify({ ...posting, profile });
}
