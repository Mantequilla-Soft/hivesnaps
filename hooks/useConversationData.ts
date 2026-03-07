import { useState, useEffect, useCallback } from 'react';
import { sortByPayoutRecursive } from '../utils/sortRepliesByPayout';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { avatarService } from '../services/AvatarService';
import { getHiveClient, hiveCallWithFailover } from '../services/HiveClient';

// Default maximum depth for fetching nested replies
const DEFAULT_MAX_REPLY_DEPTH = 10;

// Types for conversation data
export interface SnapData {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
  permlink?: string;
  hasUpvoted?: boolean;
  active_votes?: any[];
  json_metadata?: string;
  posting_json_metadata?: string;
  parent_author?: string;
  parent_permlink?: string;
  // When a post belongs to a Hive community, this will be like 'hive-124838'
  community?: string;
}

export interface ReplyData extends SnapData {
  replies?: ReplyData[];
  active_votes?: any[];
}

interface ConversationState {
  snap: SnapData | null;
  replies: ReplyData[];
  loading: boolean;
  error: string | null;
}

interface UseConversationDataReturn extends ConversationState {
  fetchSnapAndReplies: () => Promise<void>;
  refreshConversation: () => Promise<void>;
  checkForNewContent: () => Promise<boolean>; // New function to check for new content without loading state
  clearError: () => void;
  updateSnap: (
    author: string,
    permlink: string,
    updates: Partial<SnapData>
  ) => void;
  updateReply: (
    author: string,
    permlink: string,
    updates: Partial<ReplyData>
  ) => void;
}

export const useConversationData = (
  author: string | undefined,
  permlink: string | undefined,
  currentUsername: string | null
): UseConversationDataReturn => {
  const [state, setState] = useState<ConversationState>({
    snap: null,
    replies: [],
    loading: false,
    error: null,
  });

  // In-memory avatar cache (images.hive.blog) for this session
  const avatarProfileCache: Record<string, string | undefined> = {};

  // Helper function to check if current user has upvoted
  const checkHasUpvoted = useCallback((activeVotes: any[]): boolean => {
    if (!currentUsername || !Array.isArray(activeVotes)) return false;
    return activeVotes.some((v: any) => v.voter === currentUsername && v.percent > 0);
  }, [currentUsername]);

  // Recursively fetch replies, ensuring each reply has full content
  const fetchRepliesTreeWithContent = useCallback(
    async (
      author: string,
      permlink: string,
      depth = 0,
  maxDepth = DEFAULT_MAX_REPLY_DEPTH,
      parentCommunity?: string
    ): Promise<ReplyData[]> => {
      if (depth > maxDepth) return [];

      try {
        // Robust shallow replies fetch via dhive client (handles node rotation + JSON)
        const shallowReplies: any[] = await hiveCallWithFailover(client => client.database
          .call('get_content_replies', [author, permlink]))
          .catch(() => [] as any[]);

        // Batch fetch full content for all replies in parallel
        const fullContentArr = await Promise.all(
          shallowReplies.map((reply: { author: string; permlink: string }) =>
            hiveCallWithFailover(client => client.database
              .call('get_content', [reply.author, reply.permlink]))
              .catch(() => reply)
          )
        );

        // Prepare avatar URLs deterministically via images.hive.blog; warm service in background
        const authorsToFetch = Array.from(new Set(fullContentArr.map(r => r.author)));
        for (const a of authorsToFetch) {
          const cached = avatarService.getCachedAvatarUrl(a);
          avatarProfileCache[a] = cached || `https://images.hive.blog/u/${a}/avatar/original`;
        }
        // Background warm (non-blocking)
        avatarService.preloadAvatars(authorsToFetch).catch(() => {});

        // Build replies with avatar and recurse
        const fullReplies: ReplyData[] = await Promise.all(
          fullContentArr.map(async fullReply => {
            const avatarUrl =
              avatarProfileCache[fullReply.author] ||
              `https://images.hive.blog/u/${fullReply.author}/avatar/original`;
            const payout = parseFloat(
              fullReply.pending_payout_value
                ? fullReply.pending_payout_value.replace(' HBD', '')
                : '0'
            );
            // Determine this reply's community: use its own category if hive-XXXXX, else inherit from parent
            const replyCommunity =
              typeof fullReply.category === 'string' && /^hive-\d+$/i.test(fullReply.category)
                ? fullReply.category
                : parentCommunity;
            const childrenReplies = await fetchRepliesTreeWithContent(
              fullReply.author,
              fullReply.permlink,
              depth + 1,
              maxDepth,
              replyCommunity
            );
            return {
              author: fullReply.author,
              avatarUrl,
              body: fullReply.body,
              created: fullReply.created,
              voteCount: fullReply.net_votes,
              replyCount: fullReply.children,
              payout,
              permlink: fullReply.permlink,
              hasUpvoted: checkHasUpvoted(fullReply.active_votes),
              active_votes: fullReply.active_votes,
              json_metadata: fullReply.json_metadata,
              posting_json_metadata: fullReply.posting_json_metadata,
              community: replyCommunity,
              replies: childrenReplies,
            };
          })
        );
        return fullReplies;
      } catch (error) {
        if (depth === 0) {
          console.error('Error fetching replies tree:', error);
        }
        return [];
      }
    },
    []
  );

  const fetchSnapAndReplies = useCallback(async () => {
    if (!author || !permlink || !currentUsername) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Missing required parameters',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch the main post
      const post = await hiveCallWithFailover(client => client.database.call('get_content', [
        author,
        permlink,
      ]));

      // Avatar: deterministic images.hive.blog with immediate value and background warm
      const cachedMain = avatarService.getCachedAvatarUrl(post.author);
      const avatarUrl: string | undefined =
        cachedMain || `https://images.hive.blog/u/${post.author}/avatar/original`;
      avatarService.getAvatarUrl(post.author).then(({ url }) => {
        if (url && url !== avatarUrl) {
          setState(prev =>
            prev.snap && prev.snap.author === post.author
              ? { ...prev, snap: { ...prev.snap, avatarUrl: url } }
              : prev
          );
          try {
            console.log(`[Avatar][Conversation] ${post.author} -> ${url}`);
          } catch {}
        }
      }).catch(() => {});

      const snapData: SnapData = {
        author: post.author,
        avatarUrl,
        body: post.body,
        created: post.created,
        voteCount: post.net_votes,
        replyCount: post.children,
        payout: parseFloat(
          post.pending_payout_value
            ? post.pending_payout_value.replace(' HBD', '')
            : '0'
        ),
        permlink: post.permlink,
        hasUpvoted: checkHasUpvoted(post.active_votes),
        active_votes: post.active_votes,
        json_metadata: post.json_metadata,
        posting_json_metadata: post.posting_json_metadata,
        parent_author: post.parent_author,
        parent_permlink: post.parent_permlink,
        // Populate community only when category is in the 'hive-XXXXX' format
        community:
          typeof post.category === 'string' && /^hive-\d+$/i.test(post.category)
            ? post.category
            : undefined,
      };

  // Fetch replies tree with full content
  const tree = await fetchRepliesTreeWithContent(
    author,
    permlink,
    0,
    DEFAULT_MAX_REPLY_DEPTH,
    snapData.community
  );

      const sortedTree = sortByPayoutRecursive(tree);
      setState({
        snap: snapData,
        replies: sortedTree,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching snap and replies:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch conversation data',
      }));
    }
  }, [author, permlink, currentUsername, fetchRepliesTreeWithContent, checkHasUpvoted]);

  const refreshConversation = useCallback(async () => {
    await fetchSnapAndReplies();
  }, [fetchSnapAndReplies]);

  // Helper function to check if any replies have been modified
  const checkForReplyChanges = useCallback(
    (newTree: ReplyData[], oldTree: ReplyData[]): boolean => {
      // If the number of replies is different, there are changes
      if (newTree.length !== oldTree.length) {
        return true;
      }

      // Check each reply for changes
      for (let i = 0; i < newTree.length; i++) {
        const newReply = newTree[i];
        const oldReply = oldTree[i];

        // Check if the reply content has changed
        if (newReply.body !== oldReply.body) {
          return true;
        }

        // Recursively check nested replies
        if (
          checkForReplyChanges(newReply.replies || [], oldReply.replies || [])
        ) {
          return true;
        }
      }

      return false;
    },
    []
  );

  const checkForNewContent = useCallback(async () => {
    if (!author || !permlink || !currentUsername) {
      return false;
    }

    try {
      // Fetch the main post without setting loading state
      const post = await hiveCallWithFailover(client => client.database.call('get_content', [
        author,
        permlink,
      ]));

  // Fetch replies tree without setting loading state (preserve community inheritance)
  const tree = await fetchRepliesTreeWithContent(
    author,
    permlink,
    0,
    DEFAULT_MAX_REPLY_DEPTH,
    state.snap?.community
  );
  const sortedTree = sortByPayoutRecursive(tree);

      // Check if we have new content
      const hasNewReplies = tree.length > state.replies.length;
      const hasMainSnapChanges = post.body !== state.snap?.body;

      // Check if any existing replies have been modified
      const hasReplyChanges = checkForReplyChanges(tree, state.replies);

      const hasNewContent =
        hasNewReplies || hasMainSnapChanges || hasReplyChanges;

      if (hasNewContent) {
        // Update state without loading indicator
        setState(prev => ({
          ...prev,
          snap: {
            author: post.author,
            avatarUrl: prev.snap?.avatarUrl, // Keep existing avatar
            body: post.body,
            created: post.created,
            voteCount: post.net_votes,
            replyCount: post.children,
            payout: parseFloat(
              post.pending_payout_value
                ? post.pending_payout_value.replace(' HBD', '')
                : '0'
            ),
            permlink: post.permlink,
            hasUpvoted: checkHasUpvoted(post.active_votes),
            active_votes: post.active_votes,
            json_metadata: post.json_metadata,
            posting_json_metadata: post.posting_json_metadata,
            parent_author: post.parent_author,
            parent_permlink: post.parent_permlink,
            community:
              typeof post.category === 'string' && /^hive-\d+$/i.test(post.category)
                ? post.category
                : prev.snap?.community,
          },
          replies: sortedTree,
        }));
      }

      return hasNewContent;
    } catch (error) {
      console.error('Error checking for new content:', error);
      return false;
    }
  }, [
    author,
    permlink,
    currentUsername,
    fetchRepliesTreeWithContent,
    state.replies.length,
    state.snap?.body,
    checkForReplyChanges,
    checkHasUpvoted,
  ]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const { updateSingleSnap, updateSnapInTree } = useOptimisticUpdates();

  // Update snap optimistically (for upvotes, etc.)
  const updateSnap = useCallback(
    (author: string, permlink: string, updates: Partial<SnapData>) => {
      console.log('[ConversationScreen] updateSnap called:', {
        author,
        permlink,
        updates,
      });
      setState(prev => {
        const updatedSnap = updateSingleSnap(
          prev.snap,
          author,
          permlink,
          updates
        );
        console.log('[ConversationScreen] Previous snap:', prev.snap);
        console.log('[ConversationScreen] Updated snap:', updatedSnap);
        return {
          ...prev,
          snap: updatedSnap,
        };
      });
    },
    [updateSingleSnap]
  );

  // Update reply optimistically (for upvotes, etc.)
  const updateReply = useCallback(
    (author: string, permlink: string, updates: Partial<ReplyData>) => {
      console.log('[ConversationScreen] updateReply called:', {
        author,
        permlink,
        updates,
      });
      setState(prev => {
        const updatedReplies = updateSnapInTree(
          prev.replies,
          author,
          permlink,
          updates
        );
        console.log('[ConversationScreen] Previous replies:', prev.replies);
        console.log('[ConversationScreen] Updated replies:', updatedReplies);
        return {
          ...prev,
          replies: updatedReplies,
        };
      });
    },
    [updateSnapInTree]
  );

  // Fetch data when parameters change
  useEffect(() => {
    if (currentUsername) {
      fetchSnapAndReplies();
    }
  }, [author, permlink, currentUsername, fetchSnapAndReplies]);

  return {
    ...state,
    fetchSnapAndReplies,
    refreshConversation,
    checkForNewContent,
    clearError,
    updateSnap,
    updateReply,
  };
};
