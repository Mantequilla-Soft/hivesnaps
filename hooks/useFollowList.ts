import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '../services/HiveClient';
import { broadcastFollow } from '../services/HiveFollowService';
import { useFollowCacheManagement } from '../store/context';
import {
  fetchAllFollowing,
  fetchFollowPage,
  type FollowListKind,
  type HiveRpcCall,
} from '../utils/followList';

const rpc: HiveRpcCall = (api, method, params) => getClient().call(api, method, params);

export interface UseFollowListResult {
  /** Accounts loaded so far, in API (alphabetical) order. */
  names: string[];
  loading: boolean;
  error: boolean;
  /** True once the last page has been loaded. */
  done: boolean;
  /** Load the next page (no-op while loading, after an error, or when done). */
  loadMore: () => void;
  /** Retry after an error: reloads from the top if nothing loaded yet, else the next page. */
  retry: () => void;
  /** Accounts the logged-in user follows; null until loaded or when logged out. */
  myFollowing: Set<string> | null;
  /** Accounts with a follow / unfollow being broadcast. */
  pending: Set<string>;
  /** Follow or unfollow `name`; rejects if the broadcast fails. */
  toggleFollow: (name: string) => Promise<void>;
  /** True if any follow changed since the last call; resets the flag. */
  takeFollowChanged: () => boolean;
}

/**
 * State for a profile's followers / following list: paging (100 at a time),
 * plus the logged-in user's own follows for the Follow / Unfollow buttons.
 * Loads from the top whenever `active` turns on or the account/kind changes.
 */
export function useFollowList(
  username: string,
  kind: FollowListKind,
  currentUsername: string | null | undefined,
  active: boolean
): UseFollowListResult {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [myFollowing, setMyFollowing] = useState<Set<string> | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const { invalidateFollowingCache } = useFollowCacheManagement();

  const nextStart = useRef('');
  /** Only the latest request may update state; a reset makes older ones stale. */
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const changed = useRef(false);

  const loadPage = useCallback(
    async (reset: boolean): Promise<void> => {
      if (!reset && inFlight.current) return;
      const id = ++requestId.current;
      inFlight.current = true;
      setLoading(true);
      setError(false);
      try {
        const page = await fetchFollowPage(rpc, username, kind, reset ? '' : nextStart.current);
        if (id !== requestId.current) return;
        nextStart.current = page.nextStart;
        setDone(page.done);
        setNames((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base);
          return [...base, ...page.names.filter((n) => !seen.has(n))];
        });
      } catch (err) {
        console.warn(`[useFollowList] Failed to load ${kind}:`, err);
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [username, kind]
  );

  useEffect(() => {
    if (!active) return;
    nextStart.current = '';
    setNames([]);
    setDone(false);
    loadPage(true);
  }, [active, loadPage]);

  useEffect(() => {
    setMyFollowing(null);
    if (!active || !currentUsername) return;
    let cancelled = false;
    fetchAllFollowing(rpc, currentUsername)
      .then((set) => {
        if (!cancelled) setMyFollowing(set);
      })
      .catch((err) => console.warn('[useFollowList] Failed to load your following list:', err));
    return () => {
      cancelled = true;
    };
  }, [active, currentUsername]);

  const loadMore = useCallback(() => {
    if (!done && !error) loadPage(false);
  }, [done, error, loadPage]);

  const retry = useCallback(() => {
    loadPage(names.length === 0);
  }, [loadPage, names.length]);

  const toggleFollow = useCallback(
    async (name: string): Promise<void> => {
      if (!currentUsername || !myFollowing || pending.has(name)) return;
      const following = myFollowing.has(name);
      setPending((p) => new Set(p).add(name));
      try {
        await broadcastFollow(currentUsername, name, following ? [] : ['blog']);
        setMyFollowing((prev) => {
          const next = new Set(prev ?? []);
          if (following) next.delete(name);
          else next.add(name);
          return next;
        });
        changed.current = true;
        invalidateFollowingCache(currentUsername);
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(name);
          return next;
        });
      }
    },
    [currentUsername, myFollowing, pending, invalidateFollowingCache]
  );

  const takeFollowChanged = useCallback(() => {
    const was = changed.current;
    changed.current = false;
    return was;
  }, []);

  return {
    names,
    loading,
    error,
    done,
    loadMore,
    retry,
    myFollowing,
    pending,
    toggleFollow,
    takeFollowChanged,
  };
}
