import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getClient } from '../services/HiveClient';
import { findNewSnaps, type FilterableSnap } from '../utils/feedFilter';

/** How often to look for new snaps while the feed is on screen. */
export const NEW_SNAPS_POLL_MS = 30_000;

// Snaps are replies to the latest container post on this account.
const CONTAINER_ACCOUNT = 'peak.snaps';

// AppState.currentState is null (or 'unknown') until native reports it, so
// only an explicit background/inactive state pauses polling.
const isForeground = (state: string | null | undefined): boolean => state !== 'background' && state !== 'inactive';

const sameSnaps = (a: readonly FilterableSnap[], b: readonly FilterableSnap[]): boolean =>
    a.length === b.length && a.every((s, i) => s.author === b[i].author && s.permlink === b[i].permlink);

export interface NewSnapsState<T extends FilterableSnap> {
    /** Snaps newer than the feed that the current view would show, newest first. */
    newSnaps: T[];
    /** Forget the current count, e.g. after merging the new snaps in. */
    reset: () => void;
}

interface Options<T extends FilterableSnap> {
    /** The banner applies here (feed focused, snaps tab, a filter where "new" makes sense). False hides it and stops polling. */
    enabled: boolean;
    /** Stop polling but keep reporting the current count (feed loading, paginating or merging). */
    paused?: boolean;
    /** Snaps currently in the feed. */
    known: readonly FilterableSnap[];
    /** Tab filter + mutes + moderation for the current view. */
    isRelevant: (snap: T) => boolean;
    currentUser?: string | null;
    intervalMs?: number;
}

/**
 * Polls the latest snaps container while the feed is visible and the app is
 * in the foreground, and reports snaps newer than what the feed shows. It
 * never changes the feed itself: the caller decides when to merge them in.
 */
export function useNewSnaps<T extends FilterableSnap>({
    enabled,
    paused = false,
    known,
    isRelevant,
    currentUser,
    intervalMs = NEW_SNAPS_POLL_MS,
}: Options<T>): NewSnapsState<T> {
    const [newSnaps, setNewSnaps] = useState<T[]>([]);
    const [appActive, setAppActive] = useState(isForeground(AppState.currentState));

    // Latest inputs for the poller without restarting its timer on every render.
    const knownRef = useRef(known);
    const isRelevantRef = useRef(isRelevant);
    const latestRef = useRef<T[]>([]);
    knownRef.current = known;
    isRelevantRef.current = isRelevant;

    const recompute = useCallback((): void => {
        const next = findNewSnaps(latestRef.current, knownRef.current, isRelevantRef.current, currentUser);
        // Keep the same array when nothing changed, so callers passing a
        // fresh `known` array each render can't cause a render loop.
        setNewSnaps((prev) => (sameSnaps(prev, next) ? prev : next));
    }, [currentUser]);

    // The feed changed (refresh, filter switch, mute): recount against what
    // we last fetched, so merged or now-hidden snaps drop out right away.
    useEffect(() => {
        recompute();
    }, [known, isRelevant, recompute]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => setAppActive(isForeground(s)));
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (!enabled || paused || !appActive) return;
        let cancelled = false;
        let inFlight = false;

        const poll = async (): Promise<void> => {
            if (inFlight) return;
            inFlight = true;
            try {
                const client = getClient();
                const [container] = await client.database.call('get_discussions_by_blog', [
                    { tag: CONTAINER_ACCOUNT, limit: 1 },
                ]);
                if (!container || cancelled) return;
                const replies: T[] = await client.database.call('get_content_replies', [
                    container.author,
                    container.permlink,
                ]);
                if (cancelled || !Array.isArray(replies)) return;
                latestRef.current = replies;
                recompute();
            } catch (err) {
                // Non-critical: try again next tick.
                console.warn('[useNewSnaps] poll failed:', err);
            } finally {
                inFlight = false;
            }
        };

        const id = setInterval(poll, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [enabled, paused, appActive, intervalMs, recompute]);

    const reset = useCallback((): void => {
        latestRef.current = [];
        setNewSnaps((prev) => (prev.length === 0 ? prev : []));
    }, []);

    // Nothing is "new" while the banner isn't relevant (other tab, Trending sort, ...).
    return { newSnaps: enabled ? newSnaps : [], reset };
}
