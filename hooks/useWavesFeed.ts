import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWaveItems, WaveItem } from '../services/wavesFeedService';
import { avatarService } from '../services/AvatarService';
import { SnapData } from './useConversationData';
import { normalizeToUtcTimestamp } from '../utils/time';

export interface WaveSnap extends SnapData {
  isWave: true;
}

export interface UseWavesFeedResult {
  waves: WaveSnap[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  hasMore: boolean;
  fetchWaves: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useWavesFeed(username: string | null): UseWavesFeedResult {
  const [waves, setWaves] = useState<WaveSnap[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const mapToWaveSnaps = useCallback(async (items: WaveItem[]): Promise<WaveSnap[]> => {
    return Promise.all(
      items.map(async (item): Promise<WaveSnap> => {
        let avatarUrl: string | undefined;
        try {
          const result = await avatarService.getAvatarUrl(item.author);
          avatarUrl = result.url;
        } catch {
          avatarUrl = undefined;
        }

        const hasUpvoted = Array.isArray(item.active_votes) && !!username &&
          item.active_votes.some(v => v.voter === username && v.percent > 0);

        return {
          author: item.author,
          avatarUrl,
          body: item.body ?? '',
          created: normalizeToUtcTimestamp(item.created),
          voteCount: item.active_votes?.length ?? 0,
          replyCount: item.children ?? 0,
          payout: 0,
          permlink: item.permlink,
          hasUpvoted,
          active_votes: item.active_votes,
          json_metadata: item.json_metadata,
          parent_author: item.parentAuthor,
          parent_permlink: item.parentPermlink,
          isWave: true,
        };
      })
    );
  }, [username]);

  const fetchWaves = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) { setLoading(true); setError(null); }
    cursorRef.current = null;
    hasMoreRef.current = true;

    try {
      const { waves: items, nextCursor, hasMore } = await fetchWaveItems();
      const mapped = await mapToWaveSnaps(items);

      if (!isMountedRef.current) return;
      setWaves(mapped);
      hasMoreRef.current = hasMore;
      cursorRef.current = nextCursor;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load waves');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [mapToWaveSnaps]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current || !hasMoreRef.current || !cursorRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) { setLoadingMore(true); setLoadMoreError(null); }

    try {
      const { waves: items, nextCursor, hasMore } = await fetchWaveItems(cursorRef.current);
      const mapped = await mapToWaveSnaps(items);

      if (!isMountedRef.current) return;
      setWaves(prev => [...prev, ...mapped]);
      hasMoreRef.current = hasMore;
      cursorRef.current = nextCursor;
    } catch (err) {
      if (isMountedRef.current) {
        setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more waves');
      }
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [mapToWaveSnaps]);

  return {
    waves,
    loading,
    loadingMore,
    error,
    loadMoreError,
    hasMore: hasMoreRef.current,
    fetchWaves,
    loadMore,
  };
}
