import React, { useState, useRef, useCallback, useMemo } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import {
  SafeAreaView as SafeAreaViewSA,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  useColorScheme,
  Image,
  Pressable,
  ScrollView,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { ConversationScreenStyles } from '../../styles/ConversationScreenStyles';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Modal from 'react-native-modal';
import Markdown from 'react-native-markdown-display';
import {
  extractVideoInfo,
  removeTwitterUrls,
  removeEmbedUrls,
} from '../../utils/extractVideoInfo';
import { Image as ExpoImage } from 'expo-image';
import { Dimensions } from 'react-native';

import { extractImageUrls } from '../../utils/extractImageUrls';
import {
  extractRawImageUrls as extractRawImageUrlsUtil,
  removeRawImageUrls as removeRawImageUrlsUtil,
} from '../../utils/rawImageUrls';
import ImageView from 'react-native-image-viewing';
import genericAvatar from '../../assets/images/generic-avatar.png';
import { extractBlogPostUrls } from '../../utils/extractHivePostInfo';
import { ContextHivePostPreviewRenderer } from '../../components/ContextHivePostPreviewRenderer';
import { convertSpoilerSyntax, SpoilerData } from '../../utils/spoilerParser';
import SpoilerText from '../components/SpoilerText';
import TwitterEmbed from '../components/TwitterEmbed';
import YouTubeEmbed from '../components/YouTubeEmbed';
import UpvoteModal from '../../components/UpvoteModal';
import Snap from '../components/Snap';

// ContentModal removed - now using ComposeScreen for reply/edit

// Custom hooks for business logic
import { useCurrentUser } from '../../store/context';
import {
  useConversationData,
  SnapData,
  ReplyData,
} from '../../hooks/useConversationData';
import { useUpvote } from '../../hooks/useUpvote';
import { useHiveData } from '../../hooks/useHiveData';
// useReply and useEdit removed - now using ComposeScreen for reply/edit
// useGifPicker and GifPickerModal removed - now handled in ComposeScreen

import { useMutedList } from '../../store/context';


const ConversationScreenRefactored = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get navigation params
  const params = useLocalSearchParams();
  const author = params.author as string | undefined;
  const permlink = params.permlink as string | undefined;

  // Custom hooks for business logic
  const currentUsername = useCurrentUser();
  // Get muted list for current user
  const { mutedList } = useMutedList(currentUsername || '');

  const {
    snap,
    replies,
    loading,
    error: conversationError,
    refreshConversation,
    checkForNewContent,
    updateSnap,
    updateReply,
  } = useConversationData(author, permlink, currentUsername);

  const { hivePrice, globalProps, rewardFund } = useHiveData();

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
    updateSnapsOptimistically,
  } = useUpvote(
    currentUsername,
    globalProps,
    rewardFund,
    hivePrice,
    updateSnap,
    updateReply
  );

  // Removed useReply and useEdit hooks - now using ComposeScreen for reply/edit

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
  };

  // Color mapping for GIF picker modal
  const gifPickerColors = {
    background: colors.background,
    text: colors.text,
    inputBg: colors.bubble, // Use bubble color for input background
    inputBorder: colors.border,
    button: colors.button,
    buttonText: colors.buttonText,
  };

  // Removed GIF picker state - now handled in ComposeScreen

  // Local UI state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{ uri: string }>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh conversation when screen comes back into focus (e.g., after posting a reply)
  // Use a ref to track if this is the initial mount (don't refresh on first focus)
  const hasInitiallyLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasInitiallyLoadedRef.current) {
        // First time loading - don't refresh, just mark as loaded
        hasInitiallyLoadedRef.current = true;
        console.log('[ConversationScreen] Initial load, skipping auto-refresh');
        return;
      }

      // Coming back from another screen - do a full refresh to get new replies
      if (author && permlink) {
        console.log('[ConversationScreen] Screen focused, refreshing conversation...');
        refreshConversation();
      }
    }, [author, permlink, refreshConversation])
  );

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConversation();
    } finally {
      setRefreshing(false);
    }
  };

  const handleGoToParentSnap = () => {
    if (!snap?.parent_author || !snap?.parent_permlink) {
      console.log('No parent snap available');
      return;
    }

    router.push({
      pathname: '/screens/ConversationScreen',
      params: {
        author: snap.parent_author,
        permlink: snap.parent_permlink,
      },
    });
  };

  const isTopLevelSnap = () => {
    return (
      !snap?.parent_author ||
      snap.parent_author === '' ||
      snap.parent_author === 'peak.snaps'
    );
  };

  // Recursive function to find a reply in the reply tree
  const findReplyInTree = (
    replyList: ReplyData[],
    targetAuthor: string,
    targetPermlink: string
  ): ReplyData | null => {
    for (const reply of replyList) {
      if (reply.author === targetAuthor && reply.permlink === targetPermlink) {
        return reply;
      }
      // Search in nested replies
      if (reply.replies && reply.replies.length > 0) {
        const found = findReplyInTree(
          reply.replies,
          targetAuthor,
          targetPermlink
        );
        if (found) return found;
      }
    }
    return null;
  };

  const handleUpvotePress = ({
    author,
    permlink,
  }: {
    author: string;
    permlink: string;
  }) => {
    // Find the target snap (could be main snap or a reply)
    let targetSnap: SnapData | ReplyData | null = null;
    const correctAuthor = author;
    const correctPermlink = permlink;

    if (snap && snap.author === correctAuthor && snap.permlink === correctPermlink) {
      targetSnap = snap;
    } else {
      targetSnap = findReplyInTree(replies, correctAuthor, correctPermlink);
    }

    if (!targetSnap) {
      console.warn('Target snap not found for voting');
      return;
    }

    // Perform immediate optimistic update before opening modal
    if (!targetSnap.hasUpvoted) {
      // Get current vote count
      const currentVotes = targetSnap.voteCount || 0;

      // Only update vote count and visual state - NOT payout
      // Payout will be updated after modal confirmation with actual vote weight
      const optimisticUpdate = {
        hasUpvoted: true,
        voteCount: currentVotes + 1,
      };

      if (snap && snap.author === correctAuthor && snap.permlink === correctPermlink) {
        updateSnap(correctAuthor, correctPermlink, optimisticUpdate);
      } else {
        updateReply(correctAuthor, correctPermlink, optimisticUpdate);
      }
    }

    openUpvoteModal({
      author: correctAuthor,
      permlink: correctPermlink,
      snap: targetSnap,
    });
  };

  const handleReplyPress = (author: string, permlink: string) => {
    console.log('[ConversationScreen] handleReplyPress called:', {
      author,
      permlink,
    });
    console.log('[ConversationScreen] Current snap:', snap);
    console.log('[ConversationScreen] Current replies:', replies);

    // Find the snap data to pass for optimistic updates
    const snapData =
      snap && snap.author === author && snap.permlink === permlink
        ? snap
        : null;
    const replyData = findReplyInTree(replies, author, permlink);

    console.log('[ConversationScreen] Found snapData:', snapData);
    console.log('[ConversationScreen] Found replyData:', replyData);

    const targetSnap = snapData || replyData;
    console.log('[ConversationScreen] Target snap for upvote:', targetSnap);

    // Check if we found the correct snap
    if (!targetSnap) {
      console.error('[ConversationScreen] ERROR: No snap found for upvote!', {
        author,
        permlink,
      });
      return;
    }

    // Ensure we're using the correct author and permlink from the found snap
    const correctAuthor = targetSnap.author;
    const correctPermlink = targetSnap.permlink || '';

    console.log('[ConversationScreen] Opening upvote modal with:', {
      author: correctAuthor,
      permlink: correctPermlink,
      snap: targetSnap,
    });

    // Determine if this is a reply or main snap
    const isReply = !snapData && replyData;
    console.log('[ConversationScreen] Is reply:', isReply);

    openUpvoteModal({
      author: correctAuthor,
      permlink: correctPermlink,
      snap: targetSnap,
    });
    // Optimistic UI tweak: immediately mark as upvoted visually if not already
    if (!targetSnap.hasUpvoted) {
      const optimisticUpdate = { hasUpvoted: true } as any;
      if (
        snap &&
        snap.author === correctAuthor &&
        snap.permlink === correctPermlink
      ) {
        updateSnap(correctAuthor, correctPermlink, optimisticUpdate);
      } else {
        updateReply(correctAuthor, correctPermlink, optimisticUpdate);
      }
    }
  };

  const handleOpenReplyModal = (author: string, permlink: string) => {
    router.push({
      pathname: '/screens/ComposeScreen',
      params: { mode: 'reply', parentAuthor: author, parentPermlink: permlink }
    });
  };

  const handleOpenEditModal = (
    content?: { author: string; permlink: string; body: string },
    type: 'snap' | 'reply' = 'snap'
  ) => {
    if (type === 'snap') {
      if (!snap) return;
      router.push({
        pathname: '/screens/ComposeScreen',
        params: {
          mode: 'edit',
          parentAuthor: snap.author,
          parentPermlink: snap.permlink!,
          initialText: snap.body
        }
      });
    } else {
      if (!content) return;
      router.push({
        pathname: '/screens/ComposeScreen',
        params: {
          mode: 'edit',
          parentAuthor: content.author,
          parentPermlink: content.permlink,
          initialText: content.body
        }
      });
    }
  };

  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

  // Removed handleOpenGifPicker and handleSelectGif - now handled in ComposeScreen

  // Utility functions (simplified versions)
  const stripImageTags = (text: string): string => {
    let out = text.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');
    out = out.replace(/<img[^>]+src=["'][^"'>]+["'][^>]*>/g, '');
    return out;
  };

  const preserveParagraphSpacing = (text: string): string => {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\n+/g, '\n\n')
      .replace(/\n\n/g, '\n\n');
  };

  const linkifyUrls = (text: string): string => {
    return text.replace(
      /(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi,
      url => {
        if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;

        const youtubeMatch = url.match(
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
        );
        const threeSpeakMatch = url.match(
          /https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/
        );
        const ipfsMatch = url.match(/ipfs\/([A-Za-z0-9]+)/);
        const mp4Match = url.match(/\.mp4($|\?)/i);
        const twitterMatch = url.match(
          /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i
        );

        if (
          youtubeMatch ||
          threeSpeakMatch ||
          ipfsMatch ||
          mp4Match ||
          twitterMatch
        ) {
          return url;
        }

        return `[${url}](${url})`;
      }
    );
  };

  const linkifyMentions = (text: string): string => {
    return text.replace(
      /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
      (match, pre, username, offset, string) => {
        const beforeMatch = string.substring(0, offset);
        const afterMatch = string.substring(offset + match.length);

        const openBrackets = (beforeMatch.match(/\[/g) || []).length;
        const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
        const isInsideMarkdownLink =
          openBrackets > closeBrackets && afterMatch.includes('](');

        if (isInsideMarkdownLink) {
          return match;
        }

        return `${pre}[**@${username}**](profile://${username})`;
      }
    );
  };

  const linkifyHashtags = (text: string): string => {
    return text.replace(
      // Support hyphens within hashtags: #react-native, #covid-19, etc.
      // Pattern: #word(s) optionally followed by -word(s) (prevents starting/ending with -)
      /(^|[^\w/#])#([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/gi,
      (match, pre, hashtag, offset, string) => {
        const beforeMatch = string.substring(0, offset);
        const afterMatch = string.substring(offset + match.length);

        const openBrackets = (beforeMatch.match(/\[/g) || []).length;
        const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
        const isInsideMarkdownLink =
          openBrackets > closeBrackets && afterMatch.includes('](');

        if (isInsideMarkdownLink) {
          return match;
        }

        return `${pre}[**#${hashtag}**](hashtag://${hashtag})`;
      }
    );
  };

  const containsHtml = (str: string): boolean => {
    return /<([a-z][\s\S]*?)>/i.test(str);
  };

  // Extract and render Twitter/X posts
  const extractAndRenderTwitterPosts = (content: string) => {
    const videoInfo = extractVideoInfo(content);

    if (videoInfo && videoInfo.type === 'twitter') {
      console.log('🐦 Rendering Twitter post with WebView:', videoInfo);

      return (
        <View key={`twitter-${videoInfo.tweetId}`} style={{ marginBottom: 8 }}>
          <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
        </View>
      );
    }

    return null;
  };

  // Custom markdown rules (simplified)
  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      const { src, alt } = node.attributes;

      // Only process actual image URLs, ignore hashtag/profile links
      if (
        !src ||
        src.startsWith('hashtag://') ||
        src.startsWith('profile://')
      ) {
        return null;
      }

      // Check if it's actually an image URL
      const isImageUrl =
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(src) ||
        src.startsWith('data:image/') ||
        src.includes('image');

      if (!isImageUrl) {
        return null;
      }

      const uniqueKey = `${src || alt}-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <Pressable key={uniqueKey} onPress={() => handleImagePress(src)}>
          <Image
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: 1.2,
              maxHeight: 340,
              borderRadius: 14,
              marginVertical: 10,
              alignSelf: 'center',
              backgroundColor: isDark ? '#222' : '#eee',
            }}
            resizeMode='cover'
            accessibilityLabel={alt || 'image'}
          />
        </Pressable>
      );
    },
    link: (node: any, children: any, parent: any, styles: any) => {
      const { href } = node.attributes;

      if (href && href.startsWith('profile://')) {
        const username = href.replace('profile://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{
              color: colors.icon,
              fontWeight: 'bold',
              textDecorationLine: 'underline',
            }}
            onPress={() =>
              router.push(`/screens/ProfileScreen?username=${username}` as any)
            }
            accessibilityRole='link'
            accessibilityLabel={`View @${username}'s profile`}
          >
            {children}
          </Text>
        );
      }

      if (href && href.startsWith('hashtag://')) {
        const tag = href.replace('hashtag://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{
              color: colors.icon,
              fontWeight: 'bold',
              textDecorationLine: 'underline',
            }}
            onPress={() =>
              router.push({
                pathname: '/screens/DiscoveryScreen',
                params: { hashtag: tag },
              })
            }
            accessibilityRole='link'
            accessibilityLabel={`View #${tag} hashtag`}
          >
            {children}
          </Text>
        );
      }

      const uniqueKey = href
        ? `${href}-${Math.random().toString(36).substr(2, 9)}`
        : Math.random().toString(36).substr(2, 9);
      return (
        <Text
          key={uniqueKey}
          style={[{ color: colors.icon, textDecorationLine: 'underline' }]}
          onPress={() => {
            if (href) {
              Linking.openURL(href);
            }
          }}
        >
          {children}
        </Text>
      );
    },
  };

  // Component to render Hive post previews
  const HivePostPreviewRenderer: React.FC<{ postUrls: string[] }> = React.memo(
    ({ postUrls }) => {
      return (
        <ContextHivePostPreviewRenderer
          text={postUrls.join(' ')}
          colors={colors}
        />
      );
    }
  );

  // Function to flatten nested replies into a flat array with level information
  const flattenReplies = (
    replyList: ReplyData[],
    level = 0
  ): Array<ReplyData & { visualLevel: number }> => {
    const flattened: Array<ReplyData & { visualLevel: number }> = [];

    replyList.forEach(reply => {
      // Add the current reply with its visual level
      const maxVisualLevel = 2;
      const visualLevel = Math.min(level, maxVisualLevel);
      flattened.push({ ...reply, visualLevel });

      // Recursively flatten children
      if (reply.replies && reply.replies.length > 0) {
        const childReplies = flattenReplies(reply.replies, level + 1);
        flattened.push(...childReplies);
      }
    });

    return flattened;
  };

  // Memoize filtered replies to avoid re-filtering on every render
  const filteredReplies = useMemo(() => {
    return flattenReplies(replies).filter(reply => !mutedList || !mutedList.includes(reply.author));
  }, [replies, mutedList]);

  // DEPRECATED: renderReplyTree function - Now using flattened approach instead
  const renderReplyTree = (reply: ReplyData, level = 0) => {
    const videoInfo = extractVideoInfo(reply.body);
    const imageUrls = extractImageUrls(reply.body);
    const rawImageUrls = extractRawImageUrlsUtil(reply.body);
    const hivePostUrls = extractBlogPostUrls(reply.body);

    let textBody = reply.body;
    if (videoInfo || hivePostUrls.length > 0) {
      textBody = removeEmbedUrls(textBody);
    }
    // Check for Twitter posts and remove URLs if found
    const twitterPosts = extractAndRenderTwitterPosts(reply.body);
    if (twitterPosts) {
      textBody = removeTwitterUrls(textBody);
    }
    textBody = stripImageTags(textBody);
    if (rawImageUrls.length > 0) {
      textBody = removeRawImageUrlsUtil(textBody);
    }

    // Process spoiler syntax
    const spoilerData = convertSpoilerSyntax(textBody);
    textBody = spoilerData.processedText;

    textBody = preserveParagraphSpacing(textBody);
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);

    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);

    return (
      <View
        key={reply.author + reply.permlink + '-' + level}
        style={{ marginLeft: level * 18, marginBottom: 10 }}
      >
        <View
          style={[
            ConversationScreenStyles.replyBubble,
            { backgroundColor: colors.bubble },
          ]}
        >
          {/* Avatar, author, timestamp row */}
          <View style={ConversationScreenStyles.authorRow}>
            <Pressable
              onPress={() =>
                router.push(`/screens/ProfileScreen?username=${reply.author}` as any)
              }
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
              accessibilityRole='button'
              accessibilityLabel={`View ${reply.author}'s profile`}
            >
              {reply.avatarUrl ? (
                <ExpoImage
                  source={
                    reply.avatarUrl ? { uri: reply.avatarUrl } : genericAvatar
                  }
                  style={ConversationScreenStyles.avatar}
                  contentFit='cover'
                  onError={() => { }}
                />
              ) : (
                <ExpoImage
                  source={genericAvatar}
                  style={ConversationScreenStyles.avatar}
                  contentFit='cover'
                />
              )}
              <Text
                style={[
                  ConversationScreenStyles.replyAuthor,
                  { color: colors.text, marginLeft: 10 },
                ]}
              >
                {reply.author}
              </Text>
              <Text
                style={[
                  ConversationScreenStyles.snapTimestamp,
                  { color: colors.text },
                ]}
              >
                {reply.created
                  ? new Date(reply.created + 'Z').toLocaleString()
                  : ''}
              </Text>
            </Pressable>
          </View>

          {/* Images */}
          {imageUrls.length > 0 && (
            <View style={ConversationScreenStyles.imageContainer}>
              {imageUrls.map((url, idx) => (
                <Pressable
                  key={url + idx}
                  onPress={() => handleImagePress(url)}
                >
                  <ExpoImage
                    source={{ uri: url }}
                    style={ConversationScreenStyles.imageStyle}
                    contentFit='cover'
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Images from raw URLs */}
          {rawImageUrls.length > 0 && (
            <View style={ConversationScreenStyles.imageContainer}>
              {rawImageUrls.map((url, idx) => (
                <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                  <ExpoImage
                    source={{ uri: url }}
                    style={ConversationScreenStyles.imageStyle}
                    contentFit='cover'
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Video Content */}
          {videoInfo && videoInfo.type === 'youtube' && (
            <View style={{ marginBottom: 8 }}>
              <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            </View>
          )}

          {/* Hive Post Previews */}
          <HivePostPreviewRenderer postUrls={hivePostUrls} />

          {/* Twitter/X Posts */}
          {extractAndRenderTwitterPosts(reply.body)}

          {/* Spoiler Components */}
          {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
            <SpoilerText
              key={`reply-spoiler-${index}`}
              buttonText={spoiler.buttonText}
            >
              {spoiler.content}
            </SpoilerText>
          ))}

          {/* Text Content */}
          {textBody.trim().length > 0 && (
            <View
              style={{
                marginTop:
                  videoInfo || imageUrls.length > 0 || hivePostUrls.length > 0
                    ? 8
                    : 0,
              }}
            >
              {isHtml ? (
                <RenderHtml
                  contentWidth={windowWidth - level * 18 - 32}
                  source={{ html: textBody }}
                  baseStyle={{
                    color: colors.text,
                    fontSize: 14,
                    marginBottom: 4,
                    lineHeight: 20,
                  }}
                  enableExperimentalMarginCollapsing
                  tagsStyles={{
                    a: { color: colors.icon },
                    p: { marginBottom: 12, lineHeight: 20 },
                    u: { textDecorationLine: 'underline' },
                  }}
                />
              ) : (
                <Markdown
                  style={{
                    body: { color: colors.text, fontSize: 14, marginBottom: 4 },
                    paragraph: {
                      color: colors.text,
                      fontSize: 14,
                      marginBottom: 12,
                      lineHeight: 20,
                    },
                    link: { color: colors.icon },
                  }}
                  rules={markdownRules}
                >
                  {textBody}
                </Markdown>
              )}
            </View>
          )}

          <View style={ConversationScreenStyles.replyMeta}>
            <TouchableOpacity
              style={[
                ConversationScreenStyles.replyButton,
                ConversationScreenStyles.upvoteButton,
              ]}
              onPress={() =>
                handleUpvotePress({
                  author: reply.author,
                  permlink: reply.permlink!,
                })
              }
              disabled={reply.hasUpvoted}
            >
              <FontAwesome
                name='arrow-up'
                size={16}
                color={reply.hasUpvoted ? '#8e44ad' : colors.icon}
              />
            </TouchableOpacity>
            <Text
              style={[
                ConversationScreenStyles.replyMetaText,
                { color: colors.text },
              ]}
            >
              {reply.voteCount || 0}
            </Text>
            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={{ marginLeft: 12 }}
            />
            <Text
              style={[
                ConversationScreenStyles.replyMetaText,
                { color: colors.payout, marginLeft: 12 },
              ]}
            >
              {reply.payout !== undefined ? `$${reply.payout.toFixed(2)}` : ''}
            </Text>
            <View style={{ flex: 1 }} />

            {/* Edit button - only show for own replies */}
            {reply.author === currentUsername && (
              <TouchableOpacity
                style={ConversationScreenStyles.replyButton}
                onPress={() =>
                  handleOpenEditModal(
                    {
                      author: reply.author,
                      permlink: reply.permlink!,
                      body: reply.body,
                    },
                    'reply'
                  )
                }
              >
                <FontAwesome name='edit' size={14} color={colors.icon} />
                <Text
                  style={[
                    ConversationScreenStyles.replyButtonText,
                    { color: colors.icon, fontSize: 12 },
                  ]}
                >
                  Edit
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={ConversationScreenStyles.replyButton}
              onPress={() =>
                handleOpenReplyModal(reply.author, reply.permlink!)
              }
            >
              <FontAwesome name='reply' size={16} color={colors.icon} />
              <Text
                style={[
                  ConversationScreenStyles.replyButtonText,
                  { color: colors.icon },
                ]}
              >
                Reply
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Render children recursively */}
        {reply.replies &&
          reply.replies.length > 0 &&
          reply.replies.map((child, idx) => renderReplyTree(child, level + 1))}
      </View>
    );
  };

  // DEPRECATED: renderSnapHeader function - Now using Snap component instead
  const renderSnapHeader = () => {
    if (!snap) return null;

    const videoInfo = extractVideoInfo(snap.body);
    const imageUrls = extractImageUrls(snap.body);
    const rawImageUrls = extractRawImageUrlsUtil(snap.body);
    const hivePostUrls = extractBlogPostUrls(snap.body);

    let textBody = snap.body;
    if (videoInfo || hivePostUrls.length > 0) {
      textBody = removeEmbedUrls(textBody);
    }
    // Check for Twitter posts and remove URLs if found
    const twitterPosts = extractAndRenderTwitterPosts(snap.body);
    if (twitterPosts) {
      textBody = removeTwitterUrls(textBody);
    }
    textBody = stripImageTags(textBody);
    if (rawImageUrls.length > 0) {
      textBody = removeRawImageUrlsUtil(textBody);
    }

    // Process spoiler syntax
    const spoilerData = convertSpoilerSyntax(textBody);
    textBody = spoilerData.processedText;

    textBody = preserveParagraphSpacing(textBody);
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);

    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);

    return (
      <View
        style={[
          ConversationScreenStyles.snapPost,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View style={ConversationScreenStyles.authorRow}>
          <Pressable
            onPress={() =>
              router.push(`/screens/ProfileScreen?username=${snap.author}` as any)
            }
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
            accessibilityRole='button'
            accessibilityLabel={`View ${snap.author}'s profile`}
          >
            {snap.avatarUrl ? (
              <ExpoImage
                source={
                  snap.avatarUrl ? { uri: snap.avatarUrl } : genericAvatar
                }
                style={ConversationScreenStyles.avatar}
                contentFit='cover'
                onError={() => { }}
              />
            ) : (
              <ExpoImage
                source={genericAvatar}
                style={ConversationScreenStyles.avatar}
                contentFit='cover'
              />
            )}
            <Text
              style={[
                ConversationScreenStyles.snapAuthor,
                { color: colors.text, marginLeft: 10 },
              ]}
            >
              {snap.author}
            </Text>
            <Text
              style={[
                ConversationScreenStyles.snapTimestamp,
                { color: colors.text },
              ]}
            >
              {snap.created
                ? new Date(snap.created + 'Z').toLocaleString()
                : ''}
            </Text>
          </Pressable>
        </View>

        {/* Images */}
        {imageUrls.length > 0 && (
          <View style={ConversationScreenStyles.imageContainer}>
            {imageUrls.map((url, idx) => (
              <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                <ExpoImage
                  source={{ uri: url }}
                  style={ConversationScreenStyles.imageStyle}
                  contentFit='cover'
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Images from raw URLs */}
        {rawImageUrls.length > 0 && (
          <View style={ConversationScreenStyles.imageContainer}>
            {rawImageUrls.map((url, idx) => (
              <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                <ExpoImage
                  source={{ uri: url }}
                  style={ConversationScreenStyles.imageStyle}
                  contentFit='cover'
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Hive Post Previews */}
        <HivePostPreviewRenderer postUrls={hivePostUrls} />

        {/* Twitter/X Posts */}
        {extractAndRenderTwitterPosts(snap.body)}

        {/* Spoiler Components */}
        {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
          <SpoilerText key={`spoiler-${index}`} buttonText={spoiler.buttonText}>
            {spoiler.content}
          </SpoilerText>
        ))}

        {/* Text Content */}
        {textBody.trim().length > 0 && (
          <View
            style={{
              marginTop:
                videoInfo || imageUrls.length > 0 || hivePostUrls.length > 0
                  ? 8
                  : 0,
            }}
          >
            {isHtml ? (
              <RenderHtml
                contentWidth={windowWidth - 32}
                source={{ html: textBody }}
                baseStyle={{
                  color: colors.text,
                  fontSize: 15,
                  marginBottom: 8,
                  lineHeight: 22,
                }}
                enableExperimentalMarginCollapsing
                tagsStyles={{
                  a: { color: colors.icon },
                  p: { marginBottom: 16, lineHeight: 22 },
                  u: { textDecorationLine: 'underline' },
                }}
              />
            ) : (
              <Markdown
                style={{
                  body: { color: colors.text, fontSize: 15, marginBottom: 8 },
                  paragraph: {
                    color: colors.text,
                    fontSize: 15,
                    marginBottom: 16,
                    lineHeight: 22,
                  },
                  link: { color: colors.icon },
                }}
                rules={markdownRules}
              >
                {textBody}
              </Markdown>
            )}
          </View>
        )}

        <View
          style={[ConversationScreenStyles.snapMeta, { alignItems: 'center' }]}
        >
          <TouchableOpacity
            style={[
              ConversationScreenStyles.replyButton,
              ConversationScreenStyles.upvoteButton,
            ]}
            onPress={() =>
              handleUpvotePress({
                author: snap.author,
                permlink: snap.permlink!,
              })
            }
            disabled={snap.hasUpvoted}
          >
            <FontAwesome
              name='arrow-up'
              size={18}
              color={snap.hasUpvoted ? '#8e44ad' : colors.icon}
            />
          </TouchableOpacity>
          <Text
            style={[
              ConversationScreenStyles.snapMetaText,
              { color: colors.text },
            ]}
          >
            {snap.voteCount || 0}
          </Text>
          <FontAwesome
            name='comment-o'
            size={18}
            color={colors.icon}
            style={{ marginLeft: 12 }}
          />
          <Text
            style={[
              ConversationScreenStyles.snapMetaText,
              { color: colors.text },
            ]}
          >
            {snap.replyCount || 0}
          </Text>
          <Text
            style={[
              ConversationScreenStyles.snapMetaText,
              { color: colors.payout, marginLeft: 12 },
            ]}
          >
            {snap.payout ? `$${snap.payout.toFixed(2)}` : ''}
          </Text>
          <View style={{ flex: 1 }} />

          {/* Edit button - only show for own content */}
          {snap.author === currentUsername && (
            <TouchableOpacity
              style={ConversationScreenStyles.replyButton}
              onPress={() => handleOpenEditModal(undefined, 'snap')}
            >
              <FontAwesome name='edit' size={16} color={colors.icon} />
              <Text
                style={[
                  ConversationScreenStyles.replyButtonText,
                  { color: colors.icon },
                ]}
              >
                Edit
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={ConversationScreenStyles.replyButton}
            onPress={() => handleOpenReplyModal(snap.author, snap.permlink!)}
          >
            <FontAwesome name='reply' size={18} color={colors.icon} />
            <Text
              style={[
                ConversationScreenStyles.replyButtonText,
                { color: colors.icon },
              ]}
            >
              Reply
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaViewSA
      style={[
        ConversationScreenStyles.safeArea,
        { backgroundColor: isDark ? '#15202B' : '#fff' },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        enabled
      >
        {/* Image Modal */}
        <ImageView
          images={modalImages}
          imageIndex={modalImageIndex}
          visible={imageModalVisible}
          onRequestClose={() => setImageModalVisible(false)}
          backgroundColor='rgba(0, 0, 0, 0.95)'
          swipeToCloseEnabled={true}
          doubleTapToZoomEnabled={true}
          presentationStyle='fullScreen'
          HeaderComponent={() => (
            <TouchableOpacity
              style={ConversationScreenStyles.modalHeader}
              onPress={() => setImageModalVisible(false)}
              accessibilityLabel='Close image'
            >
              <FontAwesome name='close' size={20} color='#fff' />
            </TouchableOpacity>
          )}
        />

        {/* Header with back arrow */}
        <View
          style={[
            ConversationScreenStyles.header,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={ConversationScreenStyles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome name='arrow-left' size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Parent snap navigation - only show if not a top-level snap */}
          {!isTopLevelSnap() && (
            <View style={ConversationScreenStyles.headerRight}>
              <TouchableOpacity
                onPress={handleGoToParentSnap}
                style={ConversationScreenStyles.parentButton}
                accessibilityLabel='Go to parent snap'
              >
                <Text
                  style={[
                    ConversationScreenStyles.parentButtonText,
                    { color: colors.text },
                  ]}
                >
                  Parent Snap
                </Text>
                <FontAwesome
                  name='arrow-up'
                  size={16}
                  color={colors.text}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Conversation list */}
        {loading ? (
          <View style={ConversationScreenStyles.loadingContainer}>
            <FontAwesome
              name='hourglass-half'
              size={48}
              color={colors.icon}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={[
                ConversationScreenStyles.loadingText,
                { color: colors.text },
              ]}
            >
              Loading conversation...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handlePullToRefresh}
                colors={[colors.icon]}
                tintColor={colors.icon}
              />
            }
          >
            {/* Blockchain Processing Indicator removed - now handled in ComposeScreen */}

            {snap && (
              <Snap
                snap={snap}
                onUpvotePress={() =>
                  handleUpvotePress({
                    author: snap.author,
                    permlink: snap.permlink || '',
                  })
                }
                onSpeechBubblePress={() => { }} // Disable in conversation view
                onContentPress={() => { }} // Disable in conversation view
                onUserPress={username => {
                  router.push(`/screens/ProfileScreen?username=${username}` as any);
                }}
                onImagePress={handleImagePress}
                showAuthor={true}
                onHashtagPress={tag => {
                  router.push({
                    pathname: '/screens/DiscoveryScreen',
                    params: { hashtag: tag },
                  });
                }}
                onReplyPress={handleOpenReplyModal}
                onEditPress={snapData =>
                  handleOpenEditModal(
                    {
                      author: snapData.author,
                      permlink: snapData.permlink,
                      body: snapData.body,
                    },
                    'snap'
                  )
                }
                onResnapPress={(author, permlink) => {
                  const snapUrl = `https://hive.blog/@${author}/${permlink}`;
                  router.push({
                    pathname: '/screens/ComposeScreen',
                    params: { resnapUrl: snapUrl },
                  });
                }}
                currentUsername={currentUsername}
              // posting and editing props removed - now handled in ComposeScreen
              />
            )}
            <View style={ConversationScreenStyles.repliesList}>
              {filteredReplies.map(reply => (
                <Snap
                  key={reply.author + reply.permlink + '-' + reply.visualLevel}
                  snap={reply}
                  onUpvotePress={handleUpvotePress}
                  onReplyPress={handleOpenReplyModal}
                  onEditPress={(snapData: { author: string; permlink: string; body: string }) =>
                    handleOpenEditModal(snapData, 'reply')
                  }
                  onUserPress={username => {
                    router.push(`/screens/ProfileScreen?username=${username}` as any);
                  }}
                  onImagePress={handleImagePress}
                  currentUsername={currentUsername}
                  // posting and editing props removed - now handled in ComposeScreen
                  // Reply-specific props
                  visualLevel={reply.visualLevel}
                  isReply={true}
                  compactMode={true}
                  showAuthor={true}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Modals would go here - simplified for brevity */}
        {/* Upvote Modal, Reply Modal, Edit Modal, GIF Picker Modal */}

        {/* Reply and Edit modals removed - now using ComposeScreen */}

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
          colors={colors}
        />

        {/* GIF Picker Modal removed - now handled in ComposeScreen */}
      </KeyboardAvoidingView>
    </SafeAreaViewSA>
  );
};

export default ConversationScreenRefactored;

export const options = { headerShown: false };
