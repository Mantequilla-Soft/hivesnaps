import { useState, useCallback, useRef, useEffect } from 'react';
import { catchPostImage } from '@ecency/render-helper';
import { getClient } from '../services/HiveClient';
import { avatarService } from '../services/AvatarService';

export const SNAPIE_COMMUNITY = 'hive-178315';
const PAGE_SIZE = 20;

interface RawBlogPost {
  author: string;
  permlink: string;
  title?: string;
  body?: string;
  json_metadata?: string;
  created: string;
  updated?: string;
  pending_payout_value?: string;
  total_payout_value?: string;
  net_votes?: number;
  children?: number;
}

export interface BlogPost {
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: string;
  created: string;
  pending_payout_value: string;
  total_payout_value: string;
  net_votes: number;
  children: number;
  thumbnailUrl: string | null;
  avatarUrl: string;
}

/**
 * Extract a thumbnail image from a post, via @ecency/render-helper's
 * catchPostImage — the same function Ecency's own mobile app uses for this.
 * Checks json_metadata.image (string or array) first, falling back to the
 * first image found in the body (markdown or a bare image URL), with GIF
 * thumbnails left unresized so they don't lose their animation.
 *
 * catchPostImage caches its result keyed by author+permlink+last_update, so
 * author/permlink (and updated, in case of an edit) must be passed through —
 * without them every post in the feed collides on the same cache key and
 * silently reuses the first post's thumbnail for every other one.
 */
function extractThumbnail(item: RawBlogPost): string | null {
  try {
    return catchPostImage(
      {
        author: item.author,
        permlink: item.permlink,
        last_update: item.updated,
        json_metadata: item.json_metadata ?? '{}',
        body: item.body ?? '',
      },
      600,
      500
    ) ?? null;
  } catch (error) {
    console.error('[useBlogFeed] extractThumbnail threw for', item.author, item.permlink, error);
    return null;
  }
}

export interface UseBlogFeedResult {
  posts: BlogPost[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  fetchPosts: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useBlogFeed(): UseBlogFeedResult {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const cursorRef = useRef<{ author: string; permlink: string } | null>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const enrichWithAvatars = useCallback(async (rawPosts: BlogPost[]): Promise<BlogPost[]> => {
    const enriched = await Promise.all(
      rawPosts.map(async (post) => {
        try {
          const result = await avatarService.getAvatarUrl(post.author);
          return { ...post, avatarUrl: result.url };
        } catch {
          return post;
        }
      })
    );
    return enriched;
  }, []);

  const parseRawPosts = useCallback((raw: RawBlogPost[]): BlogPost[] => {
    return raw.map((item) => ({
      author: item.author,
      permlink: item.permlink,
      title: item.title ?? '',
      body: item.body ?? '',
      json_metadata: item.json_metadata ?? '{}',
      created: item.created,
      pending_payout_value: item.pending_payout_value ?? '0.000 HBD',
      total_payout_value: item.total_payout_value ?? '0.000 HBD',
      net_votes: item.net_votes ?? 0,
      children: item.children ?? 0,
      thumbnailUrl: extractThumbnail(item),
      avatarUrl: '',
    }));
  }, []);

  const fetchPosts = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) { setLoading(true); setError(null); }
    cursorRef.current = null;
    hasMoreRef.current = true;

    try {
      const client = getClient();
      // bridge.get_ranked_posts is the correct API for community posts — supports
      // cursor pagination with start_author/start_permlink without "Invalid parameters"
      const raw = await client.call('bridge', 'get_ranked_posts', {
        sort: 'created',
        tag: SNAPIE_COMMUNITY,
        limit: PAGE_SIZE,
        observer: '',
      }) as RawBlogPost[];

      const parsed = parseRawPosts(raw ?? []);
      const enriched = await enrichWithAvatars(parsed);

      if (!isMountedRef.current) return;
      setPosts(enriched);
      hasMoreRef.current = enriched.length === PAGE_SIZE;
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = { author: last.author, permlink: last.permlink };
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load blog posts');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [parseRawPosts, enrichWithAvatars]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current || !hasMoreRef.current || !cursorRef.current) return;
    isFetchingRef.current = true;
    if (isMountedRef.current) { setLoadingMore(true); setLoadMoreError(null); }

    try {
      const client = getClient();
      // bridge.get_ranked_posts does NOT include the cursor item in results,
      // so no slice needed and limit stays PAGE_SIZE.
      const raw = await client.call('bridge', 'get_ranked_posts', {
        sort: 'created',
        tag: SNAPIE_COMMUNITY,
        limit: PAGE_SIZE,
        start_author: cursorRef.current.author,
        start_permlink: cursorRef.current.permlink,
        observer: '',
      }) as RawBlogPost[];

      const parsed = parseRawPosts(raw ?? []);
      const enriched = await enrichWithAvatars(parsed);

      if (!isMountedRef.current) return;
      setPosts((prev) => [...prev, ...enriched]);
      hasMoreRef.current = enriched.length === PAGE_SIZE;
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = { author: last.author, permlink: last.permlink };
      }
    } catch (err) {
      if (isMountedRef.current) {
        setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more posts');
      }
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [parseRawPosts, enrichWithAvatars]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, loadMoreError, fetchPosts, refresh, loadMore };
}
