import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '../services/HiveClient';
import { getAvatarImageUrl } from '../services/AvatarService';
import { parseBlogPosts, type BlogPost, type RawBlogPost } from './useBlogFeed';

export const ACCOUNT_POSTS_PAGE_SIZE = 20;

/** 'posts': the account's own blog posts. 'reblogs': other authors' posts it reblogged. */
export type AccountPostKind = 'posts' | 'reblogs';

/** Bridge sort for each list: 'posts' is own top-level posts, 'blog' interleaves own posts and reblogs. */
const BRIDGE_SORT: Record<AccountPostKind, string> = { posts: 'posts', reblogs: 'blog' };

/**
 * Keep the posts that belong in this list (own posts, or someone else's for
 * reblogs) that we haven't already listed.
 */
export function onlyNewPosts<T extends { author: string; permlink: string }>(
    account: string,
    kind: AccountPostKind,
    batch: readonly T[],
    existing: readonly T[]
): T[] {
    const seen = new Set(existing.map((p) => `${p.author}/${p.permlink}`));
    const lower = account.toLowerCase();
    return batch.filter((p) => {
        const key = `${p.author}/${p.permlink}`;
        const own = p.author.toLowerCase() === lower;
        if (own !== (kind === 'posts') || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export interface UseAccountPostListResult {
    posts: BlogPost[];
    loading: boolean;
    hasMore: boolean;
    error: string | null;
    /** Load the first page (no-op once loaded) or the next one. */
    loadMore: () => Promise<void>;
    /** Start over from the newest. */
    refresh: () => Promise<void>;
}

/**
 * An account's own blog posts or its reblogs, from bridge.get_account_posts,
 * newest first. The cursor advances by the raw page, so paging keeps going
 * even when a page happens to contain nothing for this list (a stretch of
 * own posts while listing reblogs). Nothing loads until loadMore is first
 * called (the tab is opened).
 */
export function useAccountPostList(account: string | null | undefined, kind: AccountPostKind): UseAccountPostListResult {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cursorRef = useRef<{ start_author: string; start_permlink: string }>({ start_author: '', start_permlink: '' });
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const postsRef = useRef<BlogPost[]>([]);
    const generationRef = useRef(0);

    const resetState = useCallback((): void => {
        generationRef.current++;
        cursorRef.current = { start_author: '', start_permlink: '' };
        inFlightRef.current = false;
        hasMoreRef.current = true;
        postsRef.current = [];
        setPosts([]);
        setHasMore(true);
        setError(null);
        setLoading(false);
    }, []);

    // A different profile or list starts from scratch.
    useEffect(() => {
        resetState();
    }, [account, kind, resetState]);

    const loadMore = useCallback(async (): Promise<void> => {
        if (!account || inFlightRef.current || !hasMoreRef.current) return;
        inFlightRef.current = true;
        const generation = generationRef.current;
        setLoading(true);
        setError(null);
        try {
            const raw: RawBlogPost[] = await getClient().call('bridge', 'get_account_posts', {
                sort: BRIDGE_SORT[kind],
                account,
                limit: ACCOUNT_POSTS_PAGE_SIZE,
                observer: '',
                ...cursorRef.current,
            });
            if (generation !== generationRef.current) return;
            // The bridge cursor is exclusive: the next page starts after it.
            const batch = Array.isArray(raw) ? raw : [];
            const last = batch[batch.length - 1];
            if (last) cursorRef.current = { start_author: last.author, start_permlink: last.permlink };
            const more = batch.length === ACCOUNT_POSTS_PAGE_SIZE;
            hasMoreRef.current = more;
            setHasMore(more);

            const fresh = onlyNewPosts(account, kind, parseBlogPosts(batch), postsRef.current).map((p) => ({
                ...p,
                avatarUrl: p.avatarUrl || getAvatarImageUrl(p.author),
            }));
            postsRef.current = [...postsRef.current, ...fresh];
            setPosts(postsRef.current);
        } catch (err) {
            if (generation !== generationRef.current) return;
            console.warn(`[useAccountPostList] ${kind} load failed:`, err);
            setError(kind === 'posts' ? 'Couldn’t load posts.' : 'Couldn’t load reblogs.');
        } finally {
            if (generation === generationRef.current) {
                inFlightRef.current = false;
                setLoading(false);
            }
        }
    }, [account, kind]);

    const refresh = useCallback(async (): Promise<void> => {
        resetState();
        await loadMore();
    }, [resetState, loadMore]);

    return { posts, loading, hasMore, error, loadMore, refresh };
}
