import { useState, useCallback, useRef, useEffect } from 'react';
import { catchPostImage } from '@ecency/render-helper';
import { getClient } from '../services/HiveClient';
import { avatarService } from '../services/AvatarService';
import type { ActiveVote } from '../services/ModerationService';
import { activeVoteNet, deriveNetVotes } from '../utils/votes';
import { subscribePostVoted, postVoteKey, POST_VOTED_TTL_MS, type PostVotedEvent } from '../utils/globalEvents';

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
  // bridge.get_ranked_posts returns the voter list (as {voter, rshares} pairs —
  // no `percent`, see utils/votes.ts) but never `net_votes`, despite the
  // field being declared optional here for API-shape completeness.
  active_votes?: ActiveVote[];
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
  active_votes: ActiveVote[];
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
  // Successful local votes the chain may not yet reflect in a subsequent
  // fetch (hivemind indexing lag, or a fetch already in flight when the vote
  // lands). Kept so reconciled fetches never clobber the optimistic state.
  const pendingVotesRef = useRef<Map<string, { vote: PostVotedEvent; at: number }>>(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  /**
   * Apply one successful local vote onto a post list. Idempotent: the
   * voter's entry is replaced (never duplicated), and net_votes moves by the
   * exact delta between the old and new entry (+1 new, 0 re-vote, +2
   * downvote→upvote — the app only broadcasts upvotes).
   */
  const applyVote = useCallback(
    (posts: BlogPost[], vote: PostVotedEvent): BlogPost[] => {
      const { author, permlink, voter, percent } = vote;
      const index = posts.findIndex(p => p.author === author && p.permlink === permlink);
      if (index === -1) return posts;
      const post = posts[index];
      const withoutVoter = post.active_votes.filter(v => v.voter !== voter);
      const previous = post.active_votes.find(v => v.voter === voter);
      const next = [...posts];
      next[index] = {
        ...post,
        active_votes: [...withoutVoter, { voter, percent, rshares: 0 }],
        net_votes: post.net_votes - activeVoteNet(previous) + 1,
      };
      return next;
    },
    []
  );

  /** Fold every pending local vote onto freshly fetched posts. */
  const reconcilePendingVotes = useCallback(
    (posts: BlogPost[]): BlogPost[] => {
      let next = posts;
      const now = Date.now();
      for (const [key, { vote, at }] of Array.from(pendingVotesRef.current)) {
        // Past the TTL the chain has had time to catch up; stop overriding it.
        if (now - at > POST_VOTED_TTL_MS) pendingVotesRef.current.delete(key);
        else next = applyVote(next, vote);
      }
      return next;
    },
    [applyVote]
  );

  // Vote freshness: the blog feed fetches once per session, so without this
  // a vote cast on HivePostScreen would never show up when the user returns.
  // useUpvote emits globally after a successful broadcast; patch just the
  // matching post in place (keeps scroll position and pagination intact —
  // a refetch would reset both), and remember it in pendingVotesRef so a
  // fetch landing mid-flight can't clobber it (see reconcilePendingVotes).
  useEffect(() => {
    const unsub = subscribePostVoted((vote) => {
      if (!isMountedRef.current) return;
      pendingVotesRef.current.set(postVoteKey(vote.author, vote.permlink), { vote, at: Date.now() });
      setPosts(prev => applyVote(prev, vote));
    });
    return () => unsub();
  }, [applyVote]);

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
    return raw.map((item) => {
      const active_votes = Array.isArray(item.active_votes) ? item.active_votes : [];
      return {
        author: item.author,
        permlink: item.permlink,
        title: item.title ?? '',
        body: item.body ?? '',
        json_metadata: item.json_metadata ?? '{}',
        created: item.created,
        pending_payout_value: item.pending_payout_value ?? '0.000 HBD',
        total_payout_value: item.total_payout_value ?? '0.000 HBD',
        // bridge.get_ranked_posts omits net_votes entirely — derive it from
        // the voter list so the card doesn't permanently show 0 votes.
        net_votes: typeof item.net_votes === 'number' ? item.net_votes : deriveNetVotes(active_votes),
        children: item.children ?? 0,
        thumbnailUrl: extractThumbnail(item),
        avatarUrl: '',
        active_votes,
      };
    });
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
      // A successful local vote may have landed while this fetch was in
      // flight (or hivemind may not have indexed it yet) — fold those back
      // on so the response never clobbers the optimistic voted state.
      setPosts(reconcilePendingVotes(enriched));
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
  }, [parseRawPosts, enrichWithAvatars, reconcilePendingVotes]);

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
      setPosts((prev) => reconcilePendingVotes([...prev, ...enriched]));
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
  }, [parseRawPosts, enrichWithAvatars, reconcilePendingVotes]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, loadMoreError, fetchPosts, refresh, loadMore };
}
