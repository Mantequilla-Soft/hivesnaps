import { useCallback, useEffect, useRef, useState } from 'react';
import { broadcastReblog, fetchRebloggedBy } from '../services/HiveFollowService';
import { awardPoints } from '../services/pointsService';

export interface UseReblogResult {
    /** You've reblogged this post (from this app or any other). */
    reblogged: boolean;
    /** A reblog is being broadcast. */
    pending: boolean;
    /** Reblogging is possible: logged in, a top-level post, not your own. */
    canReblog: boolean;
    /** Reblog the post. Resolves false (and restores the button) if the broadcast failed. */
    reblog: () => Promise<boolean>;
}

interface Options {
    author?: string | null;
    permlink?: string | null;
    currentUser?: string | null;
    /** Only top-level posts can be reblogged on Hive (not snaps or replies). */
    isRootPost: boolean;
}

const sameUser = (a?: string | null, b?: string | null): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Reblog state and action for one post, matching snapie.io: the "already
 * reblogged" state is seeded from the chain, the button updates right away
 * and rolls back if the broadcast fails, and a successful reblog earns
 * Snapie Points.
 */
export function useReblog({ author, permlink, currentUser, isRootPost }: Options): UseReblogResult {
    const [reblogged, setReblogged] = useState(false);
    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);

    const canReblog = !!currentUser && !!author && !!permlink && isRootPost && !sameUser(author, currentUser);

    useEffect(() => {
        setReblogged(false);
        if (!canReblog || !author || !permlink) return;
        let cancelled = false;
        fetchRebloggedBy(author, permlink).then((accounts) => {
            if (!cancelled && accounts.some((a) => sameUser(a, currentUser))) setReblogged(true);
        });
        return () => {
            cancelled = true;
        };
    }, [author, permlink, currentUser, canReblog]);

    const reblog = useCallback(async (): Promise<boolean> => {
        if (!canReblog || !author || !permlink || !currentUser) return false;
        if (reblogged || pendingRef.current) return reblogged;
        pendingRef.current = true;
        setPending(true);
        setReblogged(true);
        try {
            await broadcastReblog(currentUser, author, permlink);
            awardPoints('reblog', currentUser, author, permlink);
            return true;
        } catch (err) {
            console.warn('[useReblog] reblog failed:', err);
            setReblogged(false);
            return false;
        } finally {
            pendingRef.current = false;
            setPending(false);
        }
    }, [canReblog, author, permlink, currentUser, reblogged]);

    return { reblogged, pending, canReblog, reblog };
}
