import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '../services/HiveClient';
import { getAvatarImageUrl } from '../services/AvatarService';
import { parseBlogPosts, type BlogPost, type RawBlogPost } from './useBlogFeed';

export const REBLOGS_PAGE_SIZE = 20;

/**
 * Keep only reblogs (someone else's post on this account's blog) that we
 * haven't already listed.
 */
export function onlyNewReblogs<T extends { author: string; permlink: string }>(
    account: string,
    batch: readonly T[],
    existing: readonly T[]
): T[] {
    const seen = new Set(existing.map((p) => `${p.author}/${p.permlink}`));
    const lower = account.toLowerCase();
    return batch.filter((p) => {
        const key = `${p.author}/${p.permlink}`;
        if (p.author.toLowerCase() === lower || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export interface UseAccountReblogsResult {
    reblogs: BlogPost[];
    loading: boolean;
    hasMore: boolean;
    error: string | null;
    /** Load the first page (no-op once loaded) or the next one. */
    loadMore: () => Promise<void>;
    /** Start over from the newest. */
    refresh: () => Promise<void>;
}

/**
 * Posts an account has reblogged, from bridge.get_account_posts sort 'blog'
 * (own posts and reblogs interleaved, newest first) with the account's own
 * posts filtered out. The cursor advances by the raw page, so paging keeps
 * going even when a page happens to contain no reblogs. Nothing loads until
 * loadMore is first called (the tab is opened).
 */
export function useAccountReblogs(account: string | null | undefined): UseAccountReblogsResult {
    const [reblogs, setReblogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cursorRef = useRef<{ start_author: string; start_permlink: string }>({ start_author: '', start_permlink: '' });
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const reblogsRef = useRef<BlogPost[]>([]);
    const generationRef = useRef(0);

    const resetState = useCallback((): void => {
        generationRef.current++;
        cursorRef.current = { start_author: '', start_permlink: '' };
        inFlightRef.current = false;
        hasMoreRef.current = true;
        reblogsRef.current = [];
        setReblogs([]);
        setHasMore(true);
        setError(null);
        setLoading(false);
    }, []);

    // A different profile starts from scratch.
    useEffect(() => {
        resetState();
    }, [account, resetState]);

    const loadMore = useCallback(async (): Promise<void> => {
        if (!account || inFlightRef.current || !hasMoreRef.current) return;
        inFlightRef.current = true;
        const generation = generationRef.current;
        setLoading(true);
        setError(null);
        try {
            const raw: (RawBlogPost & { reblogged_by?: string[] })[] = await getClient().call('bridge', 'get_account_posts', {
                sort: 'blog',
                account,
                limit: REBLOGS_PAGE_SIZE,
                observer: '',
                ...cursorRef.current,
            });
            if (generation !== generationRef.current) return;
            // The bridge cursor is exclusive: the next page starts after it.
            const batch = Array.isArray(raw) ? raw : [];
            const last = batch[batch.length - 1];
            if (last) cursorRef.current = { start_author: last.author, start_permlink: last.permlink };
            const more = batch.length === REBLOGS_PAGE_SIZE;
            hasMoreRef.current = more;
            setHasMore(more);

            const fresh = onlyNewReblogs(account, parseBlogPosts(batch), reblogsRef.current).map((p) => ({
                ...p,
                avatarUrl: p.avatarUrl || getAvatarImageUrl(p.author),
            }));
            reblogsRef.current = [...reblogsRef.current, ...fresh];
            setReblogs(reblogsRef.current);
        } catch (err) {
            if (generation !== generationRef.current) return;
            console.warn('[useAccountReblogs] load failed:', err);
            setError('Couldn’t load reblogs.');
        } finally {
            if (generation === generationRef.current) {
                inFlightRef.current = false;
                setLoading(false);
            }
        }
    }, [account]);

    const refresh = useCallback(async (): Promise<void> => {
        resetState();
        await loadMore();
    }, [resetState, loadMore]);

    return { reblogs, loading, hasMore, error, loadMore, refresh };
}
