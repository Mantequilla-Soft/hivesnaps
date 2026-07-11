import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchTrendingSnaps, TrendingSnap as RawTrendingSnap } from '../services/discoveryService';
import { avatarService } from '../services/AvatarService';
import { normalizeToUtcTimestamp } from '../utils/time';

export interface TrendingSnap extends RawTrendingSnap {
  avatarUrl?: string;
}

export interface UseTrendingFeedResult {
  trending: TrendingSnap[];
  loading: boolean;
  error: string | null;
  fetchTrending: () => Promise<void>;
}

// Fetched once per feed session — a fixed "what's hot right now" shelf, not
// a recurring stream like waves. No pagination/cursor needed.
export function useTrendingFeed(username: string | null): UseTrendingFeedResult {
  const [trending, setTrending] = useState<TrendingSnap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchTrending = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) { setLoading(true); setError(null); }

    try {
      const items = await fetchTrendingSnaps(username ?? undefined);

      const mapped = await Promise.all(
        items.map(async (item): Promise<TrendingSnap> => {
          let avatarUrl: string | undefined;
          try {
            const result = await avatarService.getAvatarUrl(item.author);
            avatarUrl = result.url;
          } catch {
            avatarUrl = undefined;
          }

          return {
            ...item,
            avatarUrl,
            created: normalizeToUtcTimestamp(item.created),
          };
        })
      );

      if (!isMountedRef.current) return;
      setTrending(mapped);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load trending snaps');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [username]);

  return { trending, loading, error, fetchTrending };
}
