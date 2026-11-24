import { useCallback, useEffect, useRef, useState } from 'react';
import { getAppVersion, getLastSeenVersion, loadChangelog, setLastSeenVersion } from '../services/changelogService';
import { unseenEntries, type ChangelogEntry } from '../utils/changelog';

export interface UseWhatsNewResult {
    /** Notes to show in the sheet; empty when there's nothing new. */
    entries: ChangelogEntry[];
    visible: boolean;
    /** Close the sheet and remember this version's notes were seen. */
    dismiss: () => void;
}

/**
 * Shows the installed version's "What's new" once (and any versions skipped
 * since the last one seen). Checks when `enabled` first becomes true, e.g.
 * once the feed is showing for a logged-in user.
 */
export function useWhatsNew(enabled: boolean): UseWhatsNewResult {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [visible, setVisible] = useState(false);
    // A ref, not state: setting state here would re-run the effect, and its
    // cleanup would cancel the check that just started.
    const checkedRef = useRef(false);

    useEffect(() => {
        if (!enabled || checkedRef.current) return;
        checkedRef.current = true;
        let cancelled = false;
        (async () => {
            const [all, lastSeen] = await Promise.all([loadChangelog(), getLastSeenVersion()]);
            const fresh = unseenEntries(all, getAppVersion(), lastSeen);
            if (cancelled || fresh.length === 0) return;
            setEntries(fresh);
            setVisible(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const dismiss = useCallback((): void => {
        setVisible(false);
        setLastSeenVersion(getAppVersion());
    }, []);

    return { entries, visible, dismiss };
}
