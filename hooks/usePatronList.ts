import { useCallback, useEffect, useState } from 'react';
import { getPatronsMap } from '../services/patronService';

/**
 * The set of patron accounts, for the feed's "Patrons" filter. Unlike
 * following/muted lists, this isn't scoped per viewer — it's one global
 * list, already cached (1hr TTL, 5min error backoff) inside
 * patronService.ts, so this hook is just a thin bridge from that
 * module-level cache into React state. Fetches once on mount; `refresh()`
 * is exposed for a manual pull-to-refresh, not called automatically again.
 */
export function usePatronList() {
  const [patronSet, setPatronSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const map = await getPatronsMap();
      setPatronSet(new Set(map.keys()));
    } catch (error) {
      // patronService.ts's loadPatrons() already catches its own fetch
      // failures and falls back to a (possibly empty) cached map, so this
      // shouldn't normally fire — but refresh() is called fire-and-forget
      // from an effect below, so guard here too rather than leaving an
      // unhandled rejection if that invariant ever changes.
      console.error('[usePatronList] Error loading patrons:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { patronSet, loading, refresh };
}
