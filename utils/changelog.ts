/**
 * App changelog: the "What's new" sheet and the changelog screen. Entries
 * live in `changelog/changelog.json` in this repo; the app fetches the
 * latest copy from GitHub (so it can be corrected without a store release)
 * and falls back to the copy bundled at build time.
 *
 * Each entry is one app version. Since `main` changes before a release
 * reaches users, only entries for versions up to the installed app's are
 * shown, so nobody reads about features they don't have yet.
 */

export type ChangelogItemType = 'feature' | 'improvement' | 'fix';

export interface ChangelogItem {
    type: ChangelogItemType;
    text: string;
}

export interface ChangelogEntry {
    /** App version this entry ships in, e.g. "1.4.0". */
    version: string;
    /** YYYY-MM-DD. */
    date: string;
    title?: string;
    items: ChangelogItem[];
}

const ITEM_TYPES: readonly ChangelogItemType[] = ['feature', 'improvement', 'fix'];

/** Numeric dotted-version comparison: "1.10.0" > "1.4.0". Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Well-formed entries from changelog JSON, newest version first. Malformed
 * entries and items are dropped rather than failing the whole list.
 */
export function parseChangelog(raw: unknown): ChangelogEntry[] {
    if (!isObject(raw) || !Array.isArray(raw.entries)) return [];
    const entries: ChangelogEntry[] = [];
    for (const e of raw.entries) {
        if (!isObject(e) || typeof e.version !== 'string' || !/^\d+(\.\d+)*$/.test(e.version) || typeof e.date !== 'string') continue;
        const items = (Array.isArray(e.items) ? e.items : []).filter(
            (i): i is ChangelogItem =>
                isObject(i) && typeof i.text === 'string' && i.text.trim() !== '' && ITEM_TYPES.includes(i.type as ChangelogItemType)
        );
        if (items.length === 0) continue;
        entries.push({ version: e.version, date: e.date, title: typeof e.title === 'string' ? e.title : undefined, items });
    }
    return entries.sort((a, b) => compareVersions(b.version, a.version));
}

/** Entries for versions this app has (up to and including `appVersion`). */
export function entriesForApp(entries: readonly ChangelogEntry[], appVersion: string): ChangelogEntry[] {
    return entries.filter((e) => compareVersions(e.version, appVersion) <= 0);
}

/**
 * What the "What's new" sheet should show: entries newer than the last
 * version whose notes were dismissed, up to the installed version. With
 * nothing recorded yet (new install, or an update from before this
 * feature), just the installed version's own notes.
 */
export function unseenEntries(
    entries: readonly ChangelogEntry[],
    appVersion: string,
    lastSeenVersion: string | null
): ChangelogEntry[] {
    const available = entriesForApp(entries, appVersion);
    if (lastSeenVersion === null) return available.filter((e) => compareVersions(e.version, appVersion) === 0);
    return available.filter((e) => compareVersions(e.version, lastSeenVersion) > 0);
}
