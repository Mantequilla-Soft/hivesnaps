import { useEffect, useState } from 'react';
import { fetchAccountBadges, getCachedBadges, type AccountBadge } from '../services/badgesService';

/** The PeakD-style badges a profile holds (empty while loading or on failure). */
export function useAccountBadges(username: string | null | undefined): AccountBadge[] {
    // Start from the cache so a revisited profile doesn't flash an empty row
    // (and shift the layout) before the cached answer arrives.
    const [badges, setBadges] = useState<AccountBadge[]>(() => (username ? getCachedBadges(username) ?? [] : []));

    useEffect(() => {
        setBadges(username ? getCachedBadges(username) ?? [] : []);
        if (!username) return;
        let cancelled = false;
        fetchAccountBadges(username).then((list) => {
            if (!cancelled) setBadges(list);
        });
        return () => {
            cancelled = true;
        };
    }, [username]);

    return badges;
}
