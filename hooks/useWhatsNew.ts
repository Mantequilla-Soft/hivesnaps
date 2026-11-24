import { useCallback, useEffect, useRef, useState } from 'react';
import { getAppVersion, getLastSeenVersion, loadChangelog, setLastSeenVersion } from '../services/changelogService';
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
 * since the last one seen).
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
