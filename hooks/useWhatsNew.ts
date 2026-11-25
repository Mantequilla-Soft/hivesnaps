import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getAppVersion,
    getLastSeenVersion,
    getShowOnUpdate,
    loadChangelog,
    setLastSeenVersion,
    setShowOnUpdate,
} from '../services/changelogService';
import { unseenEntries, type ChangelogEntry } from '../utils/changelog';

export interface UseWhatsNewResult {
    /** Notes to show in the sheet; empty when there's nothing new. */
    entries: ChangelogEntry[];
    /** There are unseen notes and the sheet may show now. */
    visible: boolean;
    /** Close the sheet and remember this version's notes were seen. */
    dismiss: () => void;
}

/**
 * Shows the installed version's "What's new" once (and any versions skipped
 * since the last one seen), if the user turned "Show what's new after
 * updates" on in Profile. Otherwise nothing pops up; the Profile row shows a
 * "New" label instead (useUnseenWhatsNew).
 *
 * @param enabled start the check (once), e.g. once a user is logged in
 * @param canShow whether the sheet may appear right now, e.g. the feed is
 *   the focused screen; notes found while it's false wait until it's true,
 *   so the sheet never pops up over another screen
 */
export function useWhatsNew(enabled: boolean, canShow = true): UseWhatsNewResult {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [dismissed, setDismissed] = useState(false);
    // Refs, not state: the check runs once per mount and isn't cancelled
    // when `enabled` flickers (e.g. during an account switch) — only an
    // unmount drops its result.
    const checkedRef = useRef(false);
    const mountedRef = useRef(true);
    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    useEffect(() => {
        if (!enabled || checkedRef.current) return;
        checkedRef.current = true;
        (async () => {
            if (!(await getShowOnUpdate())) return;
            const [all, lastSeen] = await Promise.all([loadChangelog(), getLastSeenVersion()]);
            const fresh = unseenEntries(all, getAppVersion(), lastSeen);
            if (mountedRef.current && fresh.length > 0) setEntries(fresh);
        })();
    }, [enabled]);

    const dismiss = useCallback((): void => {
        setDismissed(true);
        setLastSeenVersion(getAppVersion());
    }, []);

    return { entries, visible: entries.length > 0 && !dismissed && canShow, dismiss };
}

// The changelog is fetched once per app run for the "New" label; the
// last-seen version is re-read on every check, since that's what changes.
let changelogOnce: Promise<ChangelogEntry[]> | null = null;
const changelogForLabel = (): Promise<ChangelogEntry[]> => {
    if (!changelogOnce) changelogOnce = loadChangelog();
    return changelogOnce;
};

/** Tests only: forget the changelog cached for the "New" label. */
export function resetWhatsNewCacheForTests(): void {
    changelogOnce = null;
}

/**
 * True while the installed version's notes haven't been seen (opened in
 * Profile, or closed in the popup): drives the "New" label on Profile.
 * Re-checks whenever `checkKey` changes, e.g. each time Profile comes back
 * into focus. Does nothing while `enabled` is false (someone else's profile).
 */
export function useUnseenWhatsNew(checkKey: unknown = 0, enabled = true): boolean {
    const [unseen, setUnseen] = useState(false);
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        (async () => {
            const [all, lastSeen] = await Promise.all([changelogForLabel(), getLastSeenVersion()]);
            if (!cancelled) setUnseen(unseenEntries(all, getAppVersion(), lastSeen).length > 0);
        })().catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [checkKey, enabled]);
    return enabled && unseen;
}

/**
 * The "Show what's new after updates" switch: loads the saved setting (off
 * by default) and saves changes. A tap made before the saved value loads
 * wins over it, and a change that couldn't be saved is undone.
 */
export function useShowWhatsNewOnUpdate(enabled = true): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(false);
    const touchedRef = useRef(false);
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        getShowOnUpdate().then((saved) => {
            if (!cancelled && !touchedRef.current) setOn(saved);
        });
        return () => {
            cancelled = true;
        };
    }, [enabled]);
    const change = useCallback((next: boolean): void => {
        touchedRef.current = true;
        setOn(next);
        void setShowOnUpdate(next).then((saved) => {
            if (!saved) setOn(!next);
        });
    }, []);
    return [on, change];
}
