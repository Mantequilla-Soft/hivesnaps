import { useEffect, useState } from 'react';
import { getCachedMoodBadge, getMoodBadge, type MoodBadgeSku } from '../services/moodBadgeService';

/**
 * The account's equipped mood badge, or null. Every avatar on screen shares
 * one fetch of snapie.io's map; a cached value shows on the first render.
 * The result is tied to the account it was fetched for, so an avatar that
 * switches to another account never shows the previous one's badge.
 */
export function useMoodBadge(account: string | null | undefined, enabled = true): MoodBadgeSku | null {
  const key = account && enabled ? account.toLowerCase() : null;
  const [fetched, setFetched] = useState<{ key: string; sku: MoodBadgeSku | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getMoodBadge(key)
      .then(sku => {
        if (!cancelled) setFetched({ key, sku });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return null;
  if (fetched?.key === key) return fetched.sku;
  return getCachedMoodBadge(key);
}
