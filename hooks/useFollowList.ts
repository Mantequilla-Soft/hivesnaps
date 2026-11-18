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
  /** False if `myFollowing` was cut short, so a missing account is unknown. */
  myFollowingComplete: boolean;
  /** Loading `myFollowing` failed; the Follow / Unfollow buttons can't be shown. */
  myFollowingError: boolean;
  /** Retry loading `myFollowing`. */
  retryMyFollowing: () => void;
  /** Whether to show a Follow / Unfollow button for `name`, and which one. */
  followState: (name: string) => 'following' | 'not-following' | 'unknown';
  /** Accounts with a follow / unfollow being broadcast. */
  pending: Set<string>;
  /** Follow or unfollow `name`; rejects if the broadcast fails. */
  toggleFollow: (name: string) => Promise<void>;
}

/**
 * State for a profile's followers / following list: paging (100 at a time),
 * plus the logged-in user's own follows for the Follow / Unfollow buttons.
 * Loads from the top whenever `active` turns on or the account/kind changes.
 *
 * `onFollowChange` runs after every successful follow / unfollow, even one
 * that finishes after the list was closed.
 */
export function useFollowList(
  username: string,
  kind: FollowListKind,
  currentUsername: string | null | undefined,
  active: boolean,
  onFollowChange?: () => void
): UseFollowListResult {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [myFollowing, setMyFollowing] = useState<Set<string> | null>(null);
  const [myFollowingComplete, setMyFollowingComplete] = useState(true);
  const [myFollowingError, setMyFollowingError] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const { invalidateFollowingCache } = useFollowCacheManagement();

  const nextStart = useRef('');
  /** Only the latest page request may update state; a reset makes older ones stale. */
  const requestId = useRef(0);
  const inFlight = useRef(false);
  /** Bumped when the logged-in account changes; late results for an older one are dropped. */
  const accountGen = useRef(0);
  const onFollowChangeRef = useRef(onFollowChange);
  onFollowChangeRef.current = onFollowChange;

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

  const loadMyFollowing = useCallback(async (): Promise<void> => {
    const gen = ++accountGen.current;
    setMyFollowing(null);
    setMyFollowingError(false);
    setPending(new Set());
    if (!active || !currentUsername) return;
    try {
      const { following, complete } = await fetchAllFollowing(rpc, currentUsername);
      if (gen !== accountGen.current) return;
      setMyFollowing(following);
      setMyFollowingComplete(complete);
    } catch (err) {
      console.warn('[useFollowList] Failed to load your following list:', err);
      if (gen === accountGen.current) setMyFollowingError(true);
    }
  }, [active, currentUsername]);

  useEffect(() => {
    loadMyFollowing();
  }, [loadMyFollowing]);

  const loadMore = useCallback((): void => {
    if (!done && !error) loadPage(false);
  }, [done, error, loadPage]);

  const retry = useCallback((): void => {
    loadPage(names.length === 0);
  }, [loadPage, names.length]);

  const retryMyFollowing = useCallback((): void => {
    loadMyFollowing();
  }, [loadMyFollowing]);

  const followState = useCallback(
    (name: string): 'following' | 'not-following' | 'unknown' => {
      if (!myFollowing) return 'unknown';
      if (myFollowing.has(name)) return 'following';
      return myFollowingComplete ? 'not-following' : 'unknown';
    },
    [myFollowing, myFollowingComplete]
  );

  const toggleFollow = useCallback(
    async (name: string): Promise<void> => {
      if (!currentUsername || !myFollowing || pending.has(name)) return;
      const account = currentUsername;
      const gen = accountGen.current;
      const following = myFollowing.has(name);
      setPending((p) => new Set(p).add(name));
      try {
        await broadcastFollow(account, name, following ? [] : ['blog']);
        // The broadcast is done either way: refresh caches and counts for the
        // account that made it, even if the list was closed meanwhile.
        invalidateFollowingCache(account);
        onFollowChangeRef.current?.();
        if (gen !== accountGen.current) return;
        setMyFollowing((prev) => {
          const next = new Set(prev ?? []);
          if (following) next.delete(name);
          else next.add(name);
          return next;
        });
      } finally {
        if (gen === accountGen.current) {
          setPending((p) => {
            const next = new Set(p);
            next.delete(name);
            return next;
          });
        }
      }
    },
    [currentUsername, myFollowing, pending, invalidateFollowingCache]
  );

  return {
    names,
    loading,
    error,
    done,
    loadMore,
    retry,
    myFollowing,
    myFollowingComplete,
    myFollowingError,
    retryMyFollowing,
    followState,
    pending,
    toggleFollow,
  };
}
