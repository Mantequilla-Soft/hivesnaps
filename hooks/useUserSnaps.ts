import React, { useState, useCallback } from 'react';
import { hiveCallWithFailover } from '../services/HiveClient';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { avatarService } from '../services/AvatarService';

// User snap interface for profile bubbles
export interface UserSnap {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  net_votes?: number;
  children?: number;
  pending_payout_value?: string;
  total_payout_value?: string;
  active_votes?: any[];
  avatarUrl?: string; // Add avatar URL to the interface
  json_metadata?: string;
  posting_json_metadata?: string;
  [key: string]: any;
}

// Cache for user snaps to avoid refetching
const userSnapsCache = new Map<
  string,
  { snaps: UserSnap[]; timestamp: number }
>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

export const useUserSnaps = (username: string | undefined) => {
  const [userSnaps, setUserSnaps] = useState<UserSnap[]>([]);
  const [snapsLoading, setSnapsLoading] = useState(false);
  const [snapsError, setSnapsError] = useState<string | null>(null);
  const [snapsLoaded, setSnapsLoaded] = useState(false);
  const [displayedSnapsCount, setDisplayedSnapsCount] = useState(10); // Show 10 initially
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  // Check cache for user snaps
  const getCachedUserSnaps = (username: string): UserSnap[] | null => {
    const cached = userSnapsCache.get(username);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.snaps;
    }
    return null;
  };

  // Set cache for user snaps
  const setCachedUserSnaps = (username: string, snaps: UserSnap[]) => {
    userSnapsCache.set(username, { snaps, timestamp: Date.now() });
  };

  // Optimized fetch user's recent snaps from Hive blockchain
  const fetchUserSnaps = useCallback(async () => {
    if (!username) return;

    // Check cache first
    const cachedSnaps = getCachedUserSnaps(username);
    if (cachedSnaps) {
      console.log('Using cached user snaps for:', username);
      setUserSnaps(cachedSnaps);
      setSnapsLoaded(true);
      setDisplayedSnapsCount(10);
      return;
    }

    setSnapsLoading(true);
    setSnapsError(null);

    try {
      console.log('Fetching recent snaps for user:', username);

      // Get latest posts by @peak.snaps (container account) - optimized to get more posts in parallel
      const discussions = await hiveCallWithFailover(client => client.database.call(
        'get_discussions_by_blog',
        [
          {
            tag: 'peak.snaps',
            limit: 5, // Increased to get more container posts
          },
        ]
      ));

      // Fetch all replies in parallel instead of sequentially
      const replyPromises = discussions.map(async (post: any) => {
        try {
          const replies: UserSnap[] = await hiveCallWithFailover(client => client.database.call(
            'get_content_replies',
            [post.author, post.permlink]
          ));
          return replies.filter(reply => reply.author === username);
        } catch (replyError) {
          console.log(
            'Error fetching replies for post:',
            post.permlink,
            replyError
          );
          return [];
        }
      });

      // Wait for all reply requests to complete
      const replyResults = await Promise.all(replyPromises);

      // Combine all user snaps from all container posts
      let userSnapsFound: UserSnap[] = replyResults.flat();

      // Sort by created date descending (newest first)
      userSnapsFound.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      // Keep more snaps for load more functionality
      const limitedSnaps = userSnapsFound.slice(0, 50);

      // Start loading avatars for all authors using the service
      const authors = Array.from(new Set(limitedSnaps.map(snap => snap.author)));
      avatarService.preloadAvatars(authors).catch(() => {});

      // Get current avatar URLs from the service cache or deterministic images.hive.blog fallback
      const snapsWithAvatars = limitedSnaps.map(snap => ({
        ...snap,
        avatarUrl:
          avatarService.getCachedAvatarUrl(snap.author) ||
          `https://images.hive.blog/u/${snap.author}/avatar/original`,
      }));
      try {
        snapsWithAvatars.forEach(s =>
          console.log(`[Avatar][UserSnaps] initial ${s.author} -> ${s.avatarUrl || 'EMPTY'}`)
        );
      } catch {}

      // Cache the results
      setCachedUserSnaps(username, snapsWithAvatars);

      setUserSnaps(snapsWithAvatars);
      setSnapsLoaded(true);
      setDisplayedSnapsCount(10); // Reset to initial display count
      console.log(
        `Found ${snapsWithAvatars.length} recent snaps for @${username}`
      );
    } catch (error) {
      console.error('Error fetching user snaps:', error);
      setSnapsError('Failed to load recent snaps');
    } finally {
      setSnapsLoading(false);
    }
  }, [username]);

  // Subscribe to avatar updates for this user and clean up on unmount/username change
  // Ensures we don't accumulate multiple subscriptions when fetchUserSnaps is called repeatedly
  // We only care about updates for the target username since all snaps belong to that author
  React.useEffect(() => {
    if (!username) return;
    const unsubscribe = avatarService.subscribe((updatedUsername, avatarUrl) => {
      if (updatedUsername !== username) return;
      try {
        console.log(`[Avatar][UserSnaps] updated ${updatedUsername} -> ${avatarUrl || 'EMPTY'}`);
      } catch {}
      setUserSnaps(prev => prev.map(snap =>
        snap.author === updatedUsername ? { ...snap, avatarUrl } : snap
      ));
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [username]);

  // Load more snaps function
  const loadMoreSnaps = useCallback(async () => {
    setLoadMoreLoading(true);

    // Simulate loading time for better UX
    setTimeout(() => {
      const currentCount = displayedSnapsCount;
      const newCount = Math.min(currentCount + 10, userSnaps.length);
      setDisplayedSnapsCount(newCount);
      setLoadMoreLoading(false);
    }, 300); // Reduced from 500ms to 300ms
  }, [displayedSnapsCount, userSnaps.length]);

  // Extract text content from snap body (removing images and formatting)
  const extractSnapText = useCallback((body: string): string => {
    // Remove images
    let text = body.replace(/!\[.*?\]\(.*?\)/g, '');
    // Remove markdown links but keep the text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // If no text remains, return a fallback
    if (!text) {
      return 'Snap contains media or links';
    }

    // Limit length
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  }, []);

  // Check if current user has upvoted a snap
  const hasUserUpvoted = useCallback(
    (snap: UserSnap, currentUsername: string | null): boolean => {
      if (!currentUsername || !snap.active_votes) return false;
      return snap.active_votes.some(
        (vote: any) => vote.voter === currentUsername && vote.percent > 0
      );
    },
    []
  );

  // Helper function to convert UserSnap to format expected by Snap component
  const convertUserSnapToSnapProps = useCallback(
    (userSnap: UserSnap, currentUsername: string | null) => {
      // Calculate payout from pending_payout_value and total_payout_value
      const pendingPayout = parseFloat(
        (userSnap.pending_payout_value || '0.000 HBD').replace(' HBD', '')
      );
      const totalPayout = parseFloat(
        (userSnap.total_payout_value || '0.000 HBD').replace(' HBD', '')
      );
      const payout = pendingPayout + totalPayout;

      return {
        author: userSnap.author,
        avatarUrl: userSnap.avatarUrl || '', // Use the fetched avatar URL
        body: userSnap.body,
        created: userSnap.created,
        voteCount: userSnap.net_votes || 0,
        replyCount: userSnap.children || 0,
        payout: payout,
        permlink: userSnap.permlink,
        hasUpvoted: hasUserUpvoted(userSnap, currentUsername),
        community:
          typeof (userSnap as any).category === 'string' && /^hive-\d+$/i.test((userSnap as any).category)
            ? (userSnap as any).category
            : undefined,
        // Include metadata fields needed for HiveSnaps badge detection
        json_metadata: userSnap.json_metadata,
        posting_json_metadata: userSnap.posting_json_metadata,
      };
    },
    [hasUserUpvoted]
  );

  const { updateSnapInArray } = useOptimisticUpdates();

  // Update a specific snap optimistically (for upvotes, etc.)
  const updateSnap = useCallback(
    (author: string, permlink: string, updates: any) => {
      setUserSnaps(prevSnaps =>
        updateSnapInArray(prevSnaps, author, permlink, updates)
      );

      // Also update cache
      const cached = userSnapsCache.get(username || '');
      if (cached) {
        const updatedSnaps = updateSnapInArray(
          cached.snaps,
          author,
          permlink,
          updates
        );
        setCachedUserSnaps(username || '', updatedSnaps);
      }
    },
    [username, updateSnapInArray]
  );

  return {
    userSnaps,
    snapsLoading,
    snapsError,
    snapsLoaded,
    displayedSnapsCount,
    loadMoreLoading,
    fetchUserSnaps,
    loadMoreSnaps,
    extractSnapText,
    hasUserUpvoted,
    convertUserSnapToSnapProps,
    updateSnap,
  };
};
