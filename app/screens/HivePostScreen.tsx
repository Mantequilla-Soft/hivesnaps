import React, { useCallback, useMemo, useRef } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import {
  SafeAreaView as SafeAreaViewSA,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Pressable,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import PostBody from '../components/PostBody';
import { Dimensions } from 'react-native';
import { useCurrentUser } from '../../store/context';
import { useUpvote } from '../../hooks/useUpvote';
import { useHiveData } from '../../hooks/useHiveData';
import { useHivePostData } from '../../hooks/useHivePostData';
import { HivePostScreenStyles } from '../../styles/HivePostScreenStyles';
// useReply and useGifPicker removed - now using ComposeScreen for reply
import UpvoteModal from '../../components/UpvoteModal';
import { useMutedList } from '../../store/context';
import Snap from '../components/Snap';
// ContentModal and GifPickerModal removed - now using ComposeScreen
import genericAvatar from '../../assets/images/generic-avatar.png';
import { getTheme } from '../../constants/Colors';

const HivePostScreen = () => {
  const { author, permlink } = useLocalSearchParams<{
    author: string;
    permlink: string;
  }>();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUsername = useCurrentUser();
  const { hivePrice, globalProps, rewardFund } = useHiveData();

  console.log('[HivePostScreen] Component loaded with params:', {
    author,
    permlink,
  });

  // Use the new hook for post and comments data
  const {
    post,
    comments,
    loading,
    commentsLoading,
    error,
    commentsError,
    refreshAll,
    updatePost,
    updateComment,
  } = useHivePostData(author, permlink, currentUsername);

  // Get muted list for filtering comments (includes personal mutes + global blacklist)
  const { mutedList } = useMutedList(currentUsername || '');

  // Create wrapper functions for useUpvote that match expected signatures
  const handleUpdatePost = useCallback((author: string, permlink: string, updates: any) => {
    updatePost(updates);
  }, [updatePost]);

  const {
    upvoteModalVisible,
    upvoteTarget,
    voteWeight,
    voteValue,
    upvoteLoading,
    upvoteSuccess,
    voteWeightLoading,
    openUpvoteModal,
    closeUpvoteModal,
    setVoteWeight,
    confirmUpvote,
  } = useUpvote(currentUsername, globalProps, rewardFund, hivePrice, handleUpdatePost, updateComment);

  // Removed useReply and useGifPicker hooks - now using ComposeScreen for reply

  // Refresh post when screen comes back into focus (e.g., after posting a reply)
  // Use a ref to track if this is the initial mount (don't refresh on first focus)
  const hasInitiallyLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasInitiallyLoadedRef.current) {
        // First time loading - don't refresh, just mark as loaded
        hasInitiallyLoadedRef.current = true;
        console.log('[HivePostScreen] Initial load, skipping auto-refresh');
        return;
      }

      // Coming back from another screen - do a full refresh to get new replies
      if (author && permlink) {
        console.log('[HivePostScreen] Screen focused, refreshing post data...');
        refreshAll();
      }
    }, [author, permlink, refreshAll])
  );

  const handleUpvotePress = useCallback(() => {
    if (!post) return;

    openUpvoteModal({
      author: post.author,
      permlink: post.permlink,
      snap: post,
    });
  }, [post, openUpvoteModal]);

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // Handle reply modal opening
  const handleOpenReplyModal = useCallback(
    (author: string, permlink: string) => {
      router.push({
        pathname: '/screens/ComposeScreen',
        params: { mode: 'reply', parentAuthor: author, parentPermlink: permlink }
      });
    },
    [router]
  );

  // Handle resnap from a Hive Post (same behavior as in Snap/Feed/Conversation)
  const handleResnap = useCallback(() => {
    if (!post?.author || !post?.permlink) return;
    const snapUrl = `https://hive.blog/@${post.author}/${post.permlink}`;
    router.push({ pathname: '/screens/ComposeScreen', params: { resnapUrl: snapUrl } });
  }, [post, router]);

  // Removed handleOpenGifPicker and handleSelectGif - now handled in ComposeScreen

  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    border: theme.border,
    icon: theme.textSecondary,
    button: theme.button,
    buttonText: theme.buttonText,
    buttonInactive: theme.buttonInactive,
    payout: theme.payout,
  };

  const windowWidth = Dimensions.get('window').width;

  // Filter comments to exclude muted users (includes personal mutes + global blacklist)
  const filteredComments = useMemo(() => {
    if (!comments || !mutedList) return comments;

    // Ensure mutedList is a Set for efficient lookups
    const mutedSet = mutedList instanceof Set ? mutedList : new Set(mutedList);

    const filterCommentsRecursively = (commentList: typeof comments): typeof comments => {
      return commentList
        .filter(comment => !mutedSet.has(comment.author))
        .map(comment => ({
          ...comment,
          replies: comment.replies ? filterCommentsRecursively(comment.replies) : undefined,
        }));
    };

    return filterCommentsRecursively(comments);
  }, [comments, mutedList]);

  // Function to flatten nested comments into a flat array with level information
  // This follows the same pattern as ConversationScreen for consistency
  const flattenComments = (
    commentList: any[],
    level = 0
  ): Array<any & { visualLevel: number }> => {
    const flattened: Array<any & { visualLevel: number }> = [];

    commentList.forEach(comment => {
      // Add the current comment with its visual level
      const maxVisualLevel = 2;
      const visualLevel = Math.min(level, maxVisualLevel);
      flattened.push({ ...comment, visualLevel });

      // Recursively flatten children
      if (comment.replies && comment.replies.length > 0) {
        const childComments = flattenComments(comment.replies, level + 1);
        flattened.push(...childComments);
      }
    });

    return flattened;
  };

  // Handle comment upvote press
  const handleCommentUpvotePress = useCallback(
    (params: { author: string; permlink: string }) => {
      // Find the comment in our data structure
      const findComment = (
        comments: any[],
        author: string,
        permlink: string
      ): any => {
        for (const comment of comments) {
          if (comment.author === author && comment.permlink === permlink) {
            return comment;
          }
          if (comment.replies) {
            const found = findComment(comment.replies, author, permlink);
            if (found) return found;
          }
        }
        return null;
      };

      const comment = findComment(comments, params.author, params.permlink);
      if (comment) {
        openUpvoteModal({
          author: comment.author,
          permlink: comment.permlink,
          snap: comment,
        });
      }
    },
    [comments, openUpvoteModal]
  );

  // Handle image press (placeholder for now)
  const handleImagePress = useCallback((imageUrl: string) => {
    console.log('Image pressed:', imageUrl);
    // TODO: Implement image viewer
  }, []);

  if (loading) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={HivePostScreenStyles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.button} />
          <Text
            style={[HivePostScreenStyles.loadingText, { color: colors.text }]}
          >
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  // Show loading state during initial fetch, only show error after actual failure
  if (loading && !post && !error) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View
          style={HivePostScreenStyles.errorContainer}
          accessible={true}
          accessibilityLabel="Loading post"
          accessibilityHint="Please wait while the post content is being loaded"
        >
          <ActivityIndicator
            size="large"
            color={colors.icon}
            accessibilityLabel="Loading post content"
          />
          <Text
            style={[HivePostScreenStyles.errorText, { color: colors.text }]}
          >
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || (!post && !loading)) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={HivePostScreenStyles.errorContainer}>
          <FontAwesome
            name='exclamation-triangle'
            size={48}
            color={colors.icon}
          />
          <Text
            style={[HivePostScreenStyles.errorText, { color: colors.text }]}
          >
            {error || 'Post not found'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[
              HivePostScreenStyles.retryButton,
              { backgroundColor: colors.button },
            ]}
          >
            <Text
              style={[
                HivePostScreenStyles.retryButtonText,
                { color: colors.buttonText },
              ]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewSA>
    );
  }

  // Ensure post exists before rendering (should not happen due to above checks)
  if (!post) {
    return null;
  }

  return (
    <SafeAreaViewSA
      style={[
        HivePostScreenStyles.safeArea,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Header */}
      <View
        style={[
          HivePostScreenStyles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name='arrow-left' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[HivePostScreenStyles.headerTitle, { color: colors.text }]}
        >
          Hive Post
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <FontAwesome name='refresh' size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={HivePostScreenStyles.scrollContainer}
        contentContainerStyle={HivePostScreenStyles.contentContainer}
      >
        {/* Author Info */}
        <View style={HivePostScreenStyles.authorInfo}>
          <ExpoImage
            source={post.avatarUrl ? { uri: post.avatarUrl } : genericAvatar}
            style={HivePostScreenStyles.avatar}
            contentFit='cover'
          />
          <View style={HivePostScreenStyles.authorDetails}>
            <Text
              style={[HivePostScreenStyles.authorName, { color: colors.text }]}
            >
              {post.author}
            </Text>
            <Text
              style={[HivePostScreenStyles.timestamp, { color: colors.icon }]}
            >
              {new Date(post.created + 'Z').toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Title */}
        {post.title && (
          <Text style={[HivePostScreenStyles.title, { color: colors.text }]}>
            {post.title}
          </Text>
        )}

        {/* Content */}
        <PostBody body={post.body} colors={colors} isDark={isDark} />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={HivePostScreenStyles.tagsContainer}>
            {post.tags.slice(0, 5).map((tag, index) => (
              <View
                key={index}
                style={[
                  HivePostScreenStyles.tag,
                  { backgroundColor: colors.button },
                ]}
              >
                <Text
                  style={[
                    HivePostScreenStyles.tagText,
                    { color: colors.buttonText },
                  ]}
                >
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement Metrics */}
        <View
          style={[
            HivePostScreenStyles.engagementMetrics,
            { borderTopColor: colors.border },
          ]}
        >
          <View style={HivePostScreenStyles.engagementLeft}>
            <TouchableOpacity
              onPress={handleUpvotePress}
              disabled={post.hasUpvoted}
              style={HivePostScreenStyles.upvoteButton}
            >
              <FontAwesome
                name='arrow-up'
                size={20}
                color={post.hasUpvoted ? '#8e44ad' : colors.icon}
              />
            </TouchableOpacity>
            <Text
              style={[
                HivePostScreenStyles.engagementText,
                { color: colors.text },
              ]}
            >
              {post.voteCount}
            </Text>
            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={HivePostScreenStyles.commentIcon}
            />
            <Text
              style={[
                HivePostScreenStyles.engagementText,
                { color: colors.text },
              ]}
            >
              {post.replyCount}
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenReplyModal(post.author, post.permlink)}
              style={HivePostScreenStyles.replyButton}
            >
              <FontAwesome
                name='reply'
                size={16}
                color={colors.icon}
                style={HivePostScreenStyles.replyIcon}
              />
              <Text
                style={[HivePostScreenStyles.replyText, { color: colors.text }]}
              >
                Reply
              </Text>
            </TouchableOpacity>
            {/* Resnap button - follow same order as elsewhere: after Reply */}
            <TouchableOpacity
              onPress={handleResnap}
              accessibilityRole='button'
              accessibilityLabel='Resnap this post'
              style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
            >
              <FontAwesome name='retweet' size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <Text
            style={[HivePostScreenStyles.payoutText, { color: colors.payout }]}
          >
            ${post.payout.toFixed(2)}
          </Text>
        </View>

        {/* Comments Section */}
        <View style={HivePostScreenStyles.commentsSection}>
          <View
            style={[
              HivePostScreenStyles.commentsHeader,
              {
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                HivePostScreenStyles.commentsHeaderText,
                { color: colors.text },
              ]}
            >
              Comments ({post.replyCount})
            </Text>
            {commentsLoading && (
              <ActivityIndicator size='small' color={colors.button} />
            )}
          </View>

          {/* Comments Error */}
          {commentsError && (
            <View style={HivePostScreenStyles.commentsError}>
              <Text
                style={[
                  HivePostScreenStyles.commentsErrorText,
                  { color: colors.icon },
                ]}
              >
                {commentsError}
              </Text>
              <TouchableOpacity
                onPress={refreshAll}
                style={[
                  HivePostScreenStyles.retryCommentsButton,
                  { backgroundColor: colors.button },
                ]}
              >
                <Text
                  style={[
                    HivePostScreenStyles.retryCommentsButtonText,
                    { color: colors.buttonText },
                  ]}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Render Comments */}
          {!commentsLoading && !commentsError && filteredComments.length > 0 && (
            <View style={HivePostScreenStyles.commentsList}>
              {flattenComments(filteredComments).map(comment => (
                <Snap
                  key={
                    comment.author +
                    comment.permlink +
                    '-' +
                    comment.visualLevel
                  }
                  snap={{ ...comment, community: post?.category }}
                  onUpvotePress={handleCommentUpvotePress}
                  onReplyPress={handleOpenReplyModal}
                  onEditPress={(snapData: { author: string; permlink: string; body: string }) => {
                    console.log('Edit comment:', snapData);
                    // TODO: Implement edit functionality
                  }}
                  onUserPress={username => {
                    router.push(`/screens/ProfileScreen?username=${username}` as any);
                  }}
                  onImagePress={handleImagePress}
                  currentUsername={currentUsername}
                  // Reply-specific props
                  visualLevel={comment.visualLevel}
                  isReply={true}
                  compactMode={true}
                  showAuthor={true}
                />
              ))}
            </View>
          )}

          {/* No Comments State */}
          {!commentsLoading && !commentsError && filteredComments.length === 0 && (
            <View style={HivePostScreenStyles.noCommentsContainer}>
              <FontAwesome name='comment-o' size={32} color={colors.icon} />
              <Text
                style={[
                  HivePostScreenStyles.noCommentsText,
                  { color: colors.icon },
                ]}
              >
                No comments yet. Be the first to comment!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reply Modal removed - now using ComposeScreen */}

      {/* Professional GIF Picker Modal removed - now handled in ComposeScreen */}

      {/* Upvote Modal */}
      <UpvoteModal
        visible={upvoteModalVisible}
        voteWeight={voteWeight}
        voteValue={voteValue}
        voteWeightLoading={voteWeightLoading}
        upvoteLoading={upvoteLoading}
        upvoteSuccess={upvoteSuccess}
        onClose={closeUpvoteModal}
        onConfirm={confirmUpvote}
        onVoteWeightChange={setVoteWeight}
        colors={{
          background: colors.background,
          text: colors.text,
          button: colors.button,
          buttonText: colors.buttonText,
          buttonInactive: colors.buttonInactive,
          icon: colors.icon,
        }}
      />
    </SafeAreaViewSA>
  );
};

export default HivePostScreen;

export const options = { headerShown: false };
