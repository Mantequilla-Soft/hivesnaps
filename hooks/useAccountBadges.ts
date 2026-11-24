import { useEffect, useState } from 'react';
import { fetchAccountBadges, type AccountBadge } from '../services/badgesService';

/** The PeakD-style badges a profile holds (empty while loading or on failure). */
export function useAccountBadges(username: string | null | undefined): AccountBadge[] {
    const [badges, setBadges] = useState<AccountBadge[]>([]);

    useEffect(() => {
        setBadges([]);
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
