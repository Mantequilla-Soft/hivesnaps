import { useState, useCallback, useRef } from 'react';
import { getClient } from '../services/HiveClient';
import { avatarService } from '../services/AvatarService';

export const SNAPIE_COMMUNITY = 'hive-178315';
const PAGE_SIZE = 20;

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

/** Extract first image URL from json_metadata or body */
function extractThumbnail(jsonMeta: string, body: string): string | null {
  try {
    const meta = JSON.parse(jsonMeta);
    if (Array.isArray(meta.image) && meta.image.length > 0 && typeof meta.image[0] === 'string') {
      return meta.image[0];
    }
  } catch { /* ignore */ }
  const match = body.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  return match ? match[1] : null;
}

export function useBlogFeed() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<{ author: string; permlink: string } | null>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

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

  const parseRawPosts = useCallback((raw: any[]): BlogPost[] => {
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
      thumbnailUrl: extractThumbnail(item.json_metadata ?? '{}', item.body ?? ''),
      avatarUrl: '',
    }));
  }, []);

  const fetchPosts = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    cursorRef.current = null;
    hasMoreRef.current = true;

    try {
      const client = getClient();
      // bridge.get_ranked_posts is the correct API for community posts — supports
      // cursor pagination with start_author/start_permlink without "Invalid parameters"
      const raw: any[] = await client.call('bridge', 'get_ranked_posts', {
        sort: 'created',
        community: SNAPIE_COMMUNITY,
        limit: PAGE_SIZE,
        observer: '',
      });

      const parsed = parseRawPosts(raw ?? []);
      const enriched = await enrichWithAvatars(parsed);
      setPosts(enriched);
      hasMoreRef.current = enriched.length === PAGE_SIZE;
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = { author: last.author, permlink: last.permlink };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [parseRawPosts, enrichWithAvatars]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current || !hasMoreRef.current || !cursorRef.current) return;
    isFetchingRef.current = true;
    setLoadingMore(true);

    try {
      const client = getClient();
      const raw: any[] = await client.call('bridge', 'get_ranked_posts', {
        sort: 'created',
        community: SNAPIE_COMMUNITY,
        limit: PAGE_SIZE + 1, // +1 because cursor item is included in results
        start_author: cursorRef.current.author,
        start_permlink: cursorRef.current.permlink,
        observer: '',
      });

      // Drop the first item — it's the cursor (already shown)
      const newRaw = (raw ?? []).slice(1);
      const parsed = parseRawPosts(newRaw);
      const enriched = await enrichWithAvatars(parsed);
      setPosts((prev) => [...prev, ...enriched]);
      hasMoreRef.current = enriched.length === PAGE_SIZE;
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = { author: last.author, permlink: last.permlink };
      }
    } catch (err) {
      if (__DEV__) console.error('[useBlogFeed] loadMore error:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [parseRawPosts, enrichWithAvatars]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, fetchPosts, refresh, loadMore };
}
