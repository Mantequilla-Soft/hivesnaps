import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchShortsPage, ShortItem } from '../services/shortsService';
import { fetchMutedList } from '../services/HiveMuteService';
import { avatarService } from '../services/AvatarService';

const PAGE_SIZE = 10;

export interface ShortWithAvatar extends ShortItem {
  avatarUrl: string;
}

export interface UseShortsResult {
  shorts: ShortWithAvatar[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** First load (or a fresh pull-to-refresh — reshuffles the feed order). */
  fetchShorts: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Optimistically drops every short by this author, e.g. right after the
   *  viewer mutes them — mirrors snapie-io's own instant-removal behavior
   *  rather than waiting on a refetch. */
  removeAuthor: (author: string) => void;
}

export function useShorts(currentUsername: string | null): UseShortsResult {
  const [shorts, setShorts] = useState<ShortWithAvatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);
  const seedRef = useRef(String(Date.now()));
  // The shorts API is shuffled/paginated by page+seed rather than a stable
  // cursor, so the same item can plausibly reappear across pages — dedupe
  // client-side rather than trusting the server never to repeat one.
  const seenKeysRef = useRef<Set<string>>(new Set());
  const mutedRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const enrichWithAvatars = useCallback(async (items: ShortItem[]): Promise<ShortWithAvatar[]> => {
    return Promise.all(
      items.map(async item => {
        try {
          const result = await avatarService.getAvatarUrl(item.author);
          return { ...item, avatarUrl: result.url };
        } catch {
          return { ...item, avatarUrl: '' };
        }
      })
    );
  }, []);

  const loadPage = useCallback(
    async (page: number, append: boolean): Promise<void> => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);
      }

      try {
        const { items, hasMore: more } = await fetchShortsPage(page, seedRef.current, PAGE_SIZE);

        const fresh = items.filter(item => {
          if (seenKeysRef.current.has(item.id)) return false;
          if (mutedRef.current.has(item.author.toLowerCase())) return false;
          seenKeysRef.current.add(item.id);
          return true;
        });

        const enriched = await enrichWithAvatars(fresh);

        if (!isMountedRef.current) return;
        setShorts(prev => (append ? [...prev, ...enriched] : enriched));
        setHasMore(more);
        pageRef.current = page;
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load shorts');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
        isFetchingRef.current = false;
      }
    },
    [enrichWithAvatars]
  );

  const fetchShorts = useCallback(async (): Promise<void> => {
    mutedRef.current = currentUsername ? await fetchMutedList(currentUsername) : new Set();
    seedRef.current = String(Date.now());
    seenKeysRef.current = new Set();
    pageRef.current = 1;
    if (isMountedRef.current) setHasMore(true);
    await loadPage(1, false);
  }, [currentUsername, loadPage]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchShorts();
  }, [fetchShorts]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isFetchingRef.current) return;
    await loadPage(pageRef.current + 1, true);
  }, [hasMore, loadPage]);

  const removeAuthor = useCallback((author: string) => {
    const lowered = author.toLowerCase();
    setShorts(prev => prev.filter(item => item.author.toLowerCase() !== lowered));
  }, []);

  return { shorts, loading, loadingMore, error, hasMore, fetchShorts, refresh, loadMore, removeAuthor };
}
