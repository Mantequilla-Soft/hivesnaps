import { useEffect, useState } from 'react';
import { getCachedMoodBadge, getMoodBadge, type MoodBadgeSku } from '../services/moodBadgeService';

/**
 * The account's equipped mood badge, or null. Every avatar on screen shares
 * one fetch of snapie.io's map; a cached value shows on the first render.
 */
export function useMoodBadge(account: string | null | undefined, enabled = true): MoodBadgeSku | null {
  const [sku, setSku] = useState<MoodBadgeSku | null>(() => (account && enabled ? getCachedMoodBadge(account) : null));

  useEffect(() => {
    if (!account || !enabled) {
      setSku(null);
      return;
    }
    setSku(getCachedMoodBadge(account));
    let cancelled = false;
    getMoodBadge(account)
      .then(next => {
        if (!cancelled) setSku(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account, enabled]);

  return sku;
}
