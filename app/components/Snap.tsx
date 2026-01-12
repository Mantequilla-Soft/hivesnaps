import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
  Linking,
  Pressable,
  Modal,
  TouchableOpacity,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Clipboard } from 'react-native';
import { extractImageUrls } from '../../utils/extractImageUrls';
import { stripImageTags } from '../../utils/stripImageTags';
import { extractVideoInfo, removeVideoUrls, removeInstagramUrls } from '../../utils/extractVideoInfo';
import { detectMediaInBody, AUDIO_URL_PATTERN } from '../../utils/mediaDetection';
import { buildSnapieUrl } from '../../utils/snapieUrlBuilder';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';
import RenderHtml from 'react-native-render-html';
import { Video, ResizeMode } from 'expo-av';
import {
  convertSpoilerSyntax,
  type SpoilerData,
} from '../../utils/spoilerParser';
import SpoilerText from './SpoilerText';
import TwitterEmbed from './TwitterEmbed';
import YouTubeEmbed from './YouTubeEmbed';
import ThreeSpeakEmbed from './ThreeSpeakEmbed';
import AudioEmbed from './AudioEmbed';
import InstagramEmbed from './InstagramEmbed';
import { extractBlogPostUrls } from '../../utils/extractHivePostInfo';
import { OptimizedHivePostPreviewRenderer } from '../../components/OptimizedHivePostPreviewRenderer';
import { classifyUrl } from '../../utils/urlClassifier';
import { canBeResnapped } from '../../utils/postTypeDetector';
import { getMarkdownStyles } from '../../styles/markdownStyles';
import { linkStyles, useLinkTextStyle } from '../../styles/linkStyles';
import { extractRawImageUrls as extractRawImageUrlsUtil, removeRawImageUrls as removeRawImageUrlsUtil } from '../../utils/rawImageUrls';
import ModerationRequestModal, { ModerationReason, ModerationRequestPayload } from './moderation/ModerationRequestModal';
import { formatRelativeShort } from '../../utils/time';
import ActionSheet from './common/ActionSheet';
import { ICON_SIZE, HEADER_SPACING, BUTTON_TAP_PADDING, TIMESTAMP_MAX_WIDTH, USERNAME_MAX_WIDTH_PCT, HIT_SLOP_SM } from '../constants/ui';
import { useAppColors } from '../styles/colors';
import { submitReport, mapUiReasonToApi } from '../../services/reportService';
import { SnapData } from '../../hooks/useConversationData';
import { wasPostedViaHiveSnaps } from '../../utils/appDetection';

interface SnapProps {
  snap: SnapData;
  onUpvotePress?: (snap: { author: string; permlink: string }) => void;
  onSpeechBubblePress?: () => void; // NEW: handler for speech bubble
  onUserPress?: (username: string) => void; // NEW: handler for username/avatar press
  onContentPress?: () => void; // NEW: handler for content/text press
  onImagePress?: (imageUrl: string) => void; // NEW: handler for image press
  showAuthor?: boolean; // Optional: show author info in Snap bubble
  onHashtagPress?: (hashtag: string) => void; // Optional: handle hashtag press
  onReplyPress?: (author: string, permlink: string) => void; // NEW: handler for reply button
  onEditPress?: (snap: {
    author: string;
    permlink: string;
    body: string;
  }) => void; // NEW: handler for edit button
  onResnapPress?: (author: string, permlink: string) => void; // NEW: handler for resnap button
  currentUsername?: string | null; // NEW: current user to check if they can edit
  posting?: boolean; // To disable buttons during reply posting
  editing?: boolean; // To disable buttons during edit submission
  // Reply-specific props
  visualLevel?: number; // For reply indentation
  isReply?: boolean; // To enable reply-specific styling and behavior
  compactMode?: boolean; // For more compact button layout
}

// Utility to remove YouTube links (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, etc.)
const removeYouTubeUrl = (text: string): string => {
  // Remove all YouTube links (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, etc.)
  const removed = text.replace(
    /(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]{11}(\S*)?/gi,
    ''
  );
  return removed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +$/, ''))
    .join('\n');
};

// Utility to check if a string contains HTML tags
function containsHtml(str: string): boolean {
  return /<([a-z][\s\S]*?)>/i.test(str);
}

// Utility: Preprocess @username mentions to clickable profile links
function linkifyMentions(text: string): string {
  // Only match @username if not preceded by a '/' or inside a markdown link
  // Negative lookbehind for '/': (?<!/)
  // Hive usernames: 3-16 chars, a-z, 0-9, dash, dot (no @ in username)
  // Avoid emails and already-linked mentions
  return text.replace(
    /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
    (match, pre, username, offset, string) => {
      // Don't process if we're inside a markdown link [text](url)
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);

      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink =
        openBrackets > closeBrackets && afterMatch.includes('](');

      if (isInsideMarkdownLink) {
        return match; // Don't modify if inside a markdown link
      }

      // Return non-bold markdown link; bold is applied via linkStyles.mention
      return `${pre}[@${username}](profile://${username})`;
    }
  );
}

// Utility: Preprocess raw URLs to clickable markdown links (if not already linked)
function linkifyUrls(text: string): string {
  // Use our URL classifier to determine how to handle each URL
  return text.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi, url => {
    // If already inside a markdown or html link, skip
    if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;

    // Classify the URL using our utility
    const urlInfo = classifyUrl(url);

    // For now, only create markdown links for normal URLs
    // Hive posts and embedded media will be handled by their respective renderers
    if (urlInfo.type === 'normal') {
      return `[${urlInfo.displayText || url}](${url})`;
    }

    // For all other types (hive_post, embedded_media, invalid), return as-is
    // This allows the existing renderers to handle them properly
    return url;
  });
}

// Helper: Render mp4 video using expo-av Video
const renderMp4Video = (uri: string, key?: string | number) => (
  <View
    key={key || uri}
    style={{
      width: '100%',
      aspectRatio: 16 / 9,
      marginVertical: 10,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#eee',
    }}
  >
    <Video
      source={{ uri }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      style={{ width: '100%', height: '100%' }}
      shouldPlay={false}
      isLooping={false}
    />
  </View>
);

// Custom markdown rules for mp4 and video support

const Snap: React.FC<SnapProps> = ({
  snap,
  onUpvotePress,
  onSpeechBubblePress,
  onUserPress,
  onContentPress,
  onImagePress,
  showAuthor = false,
  onHashtagPress,
  onReplyPress,
  onEditPress,
  onResnapPress,
  currentUsername,
  posting = false, // Default to false
  editing = false, // Default to false
  // Reply-specific props
  visualLevel = 0,
  isReply = false,
  compactMode = false,
}) => {
  // Destructure snap properties for easier access
  const {
    author,
    avatarUrl,
    body,
    created,
    voteCount = 0,
    replyCount = 0,
    payout = 0,
    permlink,
    hasUpvoted = false,
    community,
  } = snap;

  // Detect if this content was posted via HiveSnaps (from metadata)
  const viaHiveSnaps = useMemo(
    () => wasPostedViaHiveSnaps({
      json_metadata: (snap as any).json_metadata,
      posting_json_metadata: (snap as any).posting_json_metadata,
    }),
    [(snap as any).json_metadata, (snap as any).posting_json_metadata]
  );
  // Log avatarUrl changes for debugging
  const prevAvatarRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevAvatarRef.current !== avatarUrl) {
      try {
        if (__DEV__) {
          console.log(
            `[Avatar][Snap] ${author} -> ${avatarUrl || 'EMPTY'}`
          );
        }
      } catch { }
      prevAvatarRef.current = avatarUrl;
    }
  }, [author, avatarUrl]);
  // Process hashtags in text, converting them to clickable markdown links
  function processHashtags(text: string): string {
    // Only match hashtags that are NOT part of URLs (not preceded by /)
    // Support hyphens within hashtags: #react-native, #covid-19, etc.
    // Pattern: #word(s) optionally followed by -word(s) (prevents starting/ending with -)
    return text.replace(/(^|[^\/\w])#([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/g, (match, prefix, hashtag) => {
      return `${prefix}[#${hashtag}](hashtag://${hashtag})`;
    });
  }
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const colors = useAppColors();
  const upvoteColor = hasUpvoted ? '#8e44ad' : colors.icon; // purple if upvoted
  const imageUrls = extractImageUrls(body);
  const rawImageUrls = extractRawImageUrlsUtil(body);
  const embeddedContent = extractVideoInfo(body); // Renamed from videoInfo to be more accurate
  const mediaInfo = detectMediaInBody(body); // Detect audio and video media
  const hivePostUrls = extractBlogPostUrls(body); // Extract Hive post URLs for previews
  const router = useRouter(); // For navigation in reply mode

  // Calculate indentation and content width for replies
  const maxVisualLevel = 2;
  const effectiveVisualLevel = isReply ? Math.min(visualLevel, maxVisualLevel) : 0;
  const marginLeft = effectiveVisualLevel * 18;
  const windowWidth = Dimensions.get('window').width;
  const contentWidth = isReply ? Math.max(windowWidth - marginLeft - 32, 200) : windowWidth - 32;

  // Custom markdown rules (defined inside component to access isReply and router)
  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      const { src, alt } = node.attributes;

      if (!src || src.startsWith('hashtag://') || src.startsWith('profile://')) {
        return null;
      }

      const isImageUrl =
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(src) ||
        src.startsWith('data:image/') ||
        src.includes('image');

      if (!isImageUrl) return null;

      const uniqueKey = `${src || alt}-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <Pressable
          key={uniqueKey}
          onPress={() => {
            if (onImagePress) {
              onImagePress(src);
            } else {
              setModalImageUrl(src);
              setModalVisible(true);
            }
          }}
        >
          <Image
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: 1.2,
              maxHeight: 340,
              borderRadius: 14,
              marginVertical: 10,
              alignSelf: 'center',
              backgroundColor: '#eee',
            }}
            resizeMode='cover'
            accessibilityLabel={alt || 'image'}
          />
        </Pressable>
      );
    },
    link: (node: any, children: any, parent: any, styles: any) => {
      let { href } = node.attributes;

      // Safety check: if href contains markdown syntax, extract the actual URL
      if (href && (href.includes('%5B') || href.includes('['))) {
        let textToProcess = href;

        // If URL is encoded, decode it first
        if (href.includes('%5B')) {
          textToProcess = decodeURIComponent(href);
        }

        // Extract URL from markdown link syntax [text](url)
        const markdownMatch = textToProcess.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (markdownMatch) {
          href = markdownMatch[2]; // Extract the URL part
        }
      }
      const mp4Match = href && href.match(/\.mp4($|\?)/i);
      if (mp4Match) {
        return renderMp4Video(href, href);
      }
      // Handle profile:// links for mentions
      if (href && href.startsWith('profile://')) {
        const username = href.replace('profile://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            onPress={() => {
              if (isReply) {
                router.push(`/screens/ProfileScreen?username=${username}` as any);
              } else {
                onUserPress && onUserPress(username);
              }
            }}
            accessibilityRole='link'
            accessibilityLabel={`View @${username}'s profile`}
            style={[linkStyles.base, linkStyles.mention, linkTextStyle]}
          >
            {children}
          </Text>
        );
      }
      // Handle hashtag:// links for hashtags
      if (href && href.startsWith('hashtag://')) {
        const tag = href.replace('hashtag://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            onPress={() => {
              if (isReply) {
                router.push({ pathname: '/screens/DiscoveryScreen', params: { hashtag: tag } } as any);
              } else {
                onHashtagPress && onHashtagPress(tag);
              }
            }}
            accessibilityRole='link'
            accessibilityLabel={`View #${tag} hashtag`}
            style={[linkStyles.base, linkStyles.hashtag, linkTextStyle]}
          >
            {children}
          </Text>
        );
      }
      // Default: open external link
      const uniqueKey = href
        ? `${href}-${Math.random().toString(36).substr(2, 9)}`
        : Math.random().toString(36).substr(2, 9);
      return (
        <Text
          key={uniqueKey}
          style={[linkStyles.base, linkStyles.external, linkTextStyle]}
          onPress={() => {
            if (href) {
              try {
                const urlToOpen =
                  href.startsWith('http://') || href.startsWith('https://')
                    ? href
                    : `https://${href}`;
                const urlObj = new URL(urlToOpen);
                if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
                  throw new Error('Invalid domain');
                }
                Linking.openURL(urlToOpen).catch(error => {
                  console.error('Error opening URL:', urlToOpen, error);
                });
              } catch (error) {
                console.error('Invalid URL:', href, error);
              }
            }
          }}
        >
          {children}
        </Text>
      );
    },
    html: (node: any, children: any, parent: any, styles: any) => {
      const htmlContent = node.content || '';

      // Handle <video> tags for mp4
      const videoTagMatch = htmlContent.match(
        /<video[^>]*src=["']([^"']+\.mp4)["'][^>]*>(.*?)<\/video>/i
      );
      if (videoTagMatch) {
        const mp4Url = videoTagMatch[1];
        return renderMp4Video(mp4Url, mp4Url);
      }

      // Handle IPFS iframe embeds
      const ipfsIframeMatch = htmlContent.match(
        /<iframe[^>]+src=["']([^"']*\/ipfs\/([A-Za-z0-9]+)[^"']*?)["'][^>]*>/i
      );
      if (ipfsIframeMatch) {
        const ipfsUrl = ipfsIframeMatch[1];
        const uniqueKey = `ipfs-${ipfsIframeMatch[2]}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View key={uniqueKey} style={{ marginVertical: 10 }}>
            <IPFSVideoPlayer ipfsUrl={ipfsUrl} isDark={false} />
          </View>
        );
      }

      // Default HTML rendering (let markdown handle it)
      return null;
    },
  };

  // Remove embedded content URLs and image URLs from text body if present
  let textBody = stripImageTags(body);
  if (embeddedContent) {
    textBody = removeVideoUrls(textBody);
    textBody = removeInstagramUrls(textBody);
    textBody = removeYouTubeUrl(textBody);
  }
  if (rawImageUrls.length > 0) {
    textBody = removeRawImageUrlsUtil(textBody);
  }

  // Remove 3Speak audio URLs from text body to avoid showing raw URLs
  // (they're rendered as audio embeds)
  if (AUDIO_URL_PATTERN.test(textBody)) {
    textBody = textBody.replace(AUDIO_URL_PATTERN, '').trim();
    // Clean up extra whitespace
    textBody = textBody
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +$/, ''))
      .join('\n');
  }

  // Remove Hive post URLs from text body to avoid showing raw URLs
  if (hivePostUrls.length > 0) {
    hivePostUrls.forEach(url => {
      textBody = textBody.replace(url, '').trim();
    });
    // Clean up horizontal double spaces only, preserving paragraph breaks
    textBody = textBody
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +$/, ''))
      .join('\n');
  }

  // Process spoiler syntax first, before other text processing
  const spoilerData = convertSpoilerSyntax(textBody);
  textBody = spoilerData.processedText;

  // Add: linkify URLs first, then mentions, then hashtags (order matters!)
  textBody = linkifyUrls(textBody);
  textBody = linkifyMentions(textBody);
  textBody = processHashtags(textBody);
  // Remove extraction of external links
  const cleanTextBody = textBody; // Just use the processed textBody
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  // Moderation modal visibility
  const [moderationVisible, setModerationVisible] = useState(false);
  const handleOpenModeration = () => setModerationVisible(true);
  const handleSubmitModeration = async (payload: ModerationRequestPayload) => {
    // Submit to report API: requires community, author, permlink, reason
    // Prefer prop community if provided; otherwise attempt to parse from json_metadata/category upstream
    const communityId = community;
    const mapped = mapUiReasonToApi(payload.reason, payload.details);
    try {
      const res = await submitReport({
        community: communityId || '',
        author,
        permlink: permlink || '',
        reason: mapped.reason,
        details: mapped.details,
      });
      if (__DEV__) {
        console.log('[Report][API] status:', res.status, res.body);
      }

      // Show success or failure feedback to user
      if (res.ok) {
        Alert.alert(
          'Report Submitted',
          'Thank you for reporting this content. Our moderation team will review it shortly.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Report Failed',
          `Failed to submit report. Please try again later. (Status: ${res.status})`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (e) {
      console.error('[Report][API] error:', e);
      // Show error feedback to user
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      Alert.alert(
        'Report Failed',
        `Could not submit report: ${errorMessage}. Please check your connection and try again.`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setModerationVisible(false);
    }
  };

  // Copy to clipboard handler
  const handleCopyToClipboard = () => {
    Clipboard.setString(cleanTextBody);
    setMoreMenuVisible(false);
    Alert.alert('Copied!', 'Snap content copied to clipboard');
  };

  // Share snap handler
  const handleShareSnap = async () => {
    setMoreMenuVisible(false);

    // Guard: ensure permlink is defined before sharing
    if (!permlink) {
      console.warn('[handleShareSnap] Cannot share: permlink is undefined');
      Alert.alert('Share Failed', 'Unable to share snap. Snap information is missing.');
      return;
    }

    try {
      const snapUrl = buildSnapieUrl(author, permlink);

      await Share.share({
        message: snapUrl,
        url: snapUrl, // iOS uses this
        title: `Check out this snap by @${author}`,
      });
    } catch (error) {
      console.error('Error sharing snap:', error);
      // Don't show alert for user cancellation - check multiple error indicators
      const shareError = error as { message?: string; code?: string };
      const isUserCancelled =
        shareError.message === 'User did not share' ||
        shareError.code === 'CANCELLED' ||
        shareError.code === 'ECANCELLED' ||
        shareError.code === 'E_SHARE_CANCELLED';

      if (!isUserCancelled) {
        Alert.alert('Share Failed', 'Unable to share snap. Please try again.');
      }
    }
  };
  // Overflow (three-dots) menu
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // Remove global side-effects previously used for handlers
  // (globalThis references deleted)

  // Memoized link text style uses theme + reply sizing
  const linkTextStyle = useLinkTextStyle(colors.icon, isReply);

  // Map current colors to ThemeColors expected by buildMarkdownStyles
  const markdownThemeColors = {
    text: colors.text,
    button: (colors as any).button || colors.icon || '#3b82f6',
    border: colors.border,
    card: (colors as any).card || colors.background,
    icon: colors.icon,
    background: colors.background,
  };

  const markdownDisplayStyles = getMarkdownStyles(colors, isDark);

  // Where cleanTextBody is derived before rendering Markdown/HTML
  const finalRenderedBody = cleanTextBody;

  return (
    <View
      style={{
        marginLeft: marginLeft,
        marginBottom: isReply ? 10 : undefined,
      }}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bubble,
            borderColor: colors.border,
            width: '100%',
            alignSelf: 'stretch',
          },
        ]}
      >
        {/* Image Modal */}
        <Modal
          visible={modalVisible}
          transparent
          animationType='fade'
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <FontAwesome name='close' size={28} color='#fff' />
              </TouchableOpacity>
              {modalImageUrl && (
                <Image
                  source={{ uri: modalImageUrl }}
                  style={styles.fullImage}
                  resizeMode='contain'
                />
              )}
            </View>
          </View>
        </Modal>
        {/* Top row: avatar, username, timestamp (conditionally rendered) */}
        {(showAuthor || isReply) && (
          <View style={styles.topRow}>
            <Pressable
              onPress={() => onUserPress && onUserPress(author)}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexShrink: 1,
                  minWidth: 0, // allow username to shrink/ellipsize
                },
              ]}
              disabled={!onUserPress}
              accessibilityRole='button'
              accessibilityLabel={`View ${author}'s profile`}
            >
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require('../../assets/images/generic-avatar.png')
                }
                style={styles.avatar}
              />
              <Text
                style={[styles.username, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode='tail'
              >
                {author}
              </Text>
            </Pressable>
            <View style={styles.topRightCluster}>
              {viaHiveSnaps && (
                <Image
                  source={require('../../assets/images/hivesnaps-badge.png')}
                  style={styles.avatar}
                  accessibilityLabel='Posted with HiveSnaps'
                />
              )}
              <Text
                style={[styles.timestamp, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode='tail'
                accessibilityLabel={new Date(created + 'Z').toLocaleString()}
              >
                {formatRelativeShort(new Date(created + 'Z'))}
              </Text>
              {/* Moderation flag button */}
              <Pressable
                onPress={() => setMoreMenuVisible(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginLeft: 10, padding: 4 }]}
                accessibilityRole='button'
                accessibilityLabel='More options'
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FontAwesome name='ellipsis-h' size={18} color={colors.icon} />
              </Pressable>
            </View>
          </View>
        )}
        {/* Embedded Content (Videos, Twitter posts, etc.) */}
        {embeddedContent && (
          <View style={{ marginBottom: 8 }}>
            {embeddedContent.type === 'ipfs' ? (
              <IPFSVideoPlayer
                ipfsUrl={embeddedContent.embedUrl}
                isDark={isDark}
              />
            ) : embeddedContent.type === 'twitter' ? (
              <TwitterEmbed embedUrl={embeddedContent.embedUrl} isDark={isDark} />
            ) : embeddedContent.type === 'instagram' ? (
              <InstagramEmbed embedUrl={embeddedContent.embedUrl} isDark={isDark} />
            ) : embeddedContent.type === 'youtube' ? (
              <YouTubeEmbed embedUrl={embeddedContent.embedUrl} isDark={isDark} />
            ) : embeddedContent.type === '3speak' ? (
              <ThreeSpeakEmbed
                embedUrl={embeddedContent.embedUrl}
                isDark={isDark}
              />
            ) : null}
          </View>
        )}

        {/* Audio embeds from 3Speak Audio */}
        {mediaInfo.hasAudio && mediaInfo.audioUrl && (
          <View style={{ marginBottom: 8 }}>
            <AudioEmbed embedUrl={mediaInfo.audioUrl} />
          </View>
        )}

        {/* Images from markdown/html */}
        {imageUrls.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            {imageUrls.map((url, idx) => (
              <Pressable
                key={url + idx}
                onPress={() => {
                  if (onImagePress) {
                    onImagePress(url);
                  } else {
                    setModalImageUrl(url);
                    setModalVisible(true);
                  }
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 12,
                    marginBottom: 6,
                    backgroundColor: '#eee',
                  }}
                  resizeMode='cover'
                />
              </Pressable>
            ))}
          </View>
        )}
        {/* Images from raw URLs */}
        {rawImageUrls.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            {rawImageUrls.map((url, idx) => (
              <Pressable
                key={url + idx}
                onPress={() => {
                  if (onImagePress) {
                    onImagePress(url);
                  } else {
                    setModalImageUrl(url);
                    setModalVisible(true);
                  }
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 12,
                    marginBottom: 6,
                    backgroundColor: '#eee',
                  }}
                  resizeMode='cover'
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Spoiler Components */}
        {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
          <SpoilerText key={`spoiler-${index}`} buttonText={spoiler.buttonText}>
            {spoiler.content}
          </SpoilerText>
        ))}

        {/* Body */}
        {cleanTextBody.length > 0 &&
          (() => {
            const isHtml = containsHtml(cleanTextBody);
            if (onContentPress) {
              return (
                <Pressable
                  onPress={onContentPress}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                  accessibilityRole='button'
                  accessibilityLabel='View conversation'
                >
                  {isHtml ? (
                    <RenderHtml
                      contentWidth={contentWidth}
                      source={{ html: cleanTextBody }}
                      baseStyle={{
                        color: colors.text,
                        fontSize: isReply ? 14 : 15,
                        marginBottom: 8,
                        lineHeight: isReply ? 20 : undefined,
                      }}
                      enableExperimentalMarginCollapsing
                      tagsStyles={{
                        a: { color: colors.icon },
                        u: { textDecorationLine: 'underline' },
                        ...(isReply && { p: { marginBottom: 12, lineHeight: 20 } }),
                      }}
                      renderers={{
                        video: (props: any) => {
                          const src = props?.tnode?.attributes?.src;
                          const TDefaultRenderer = props?.TDefaultRenderer;
                          if (src && src.endsWith('.mp4')) {
                            return renderMp4Video(src);
                          }
                          return TDefaultRenderer ? (
                            <TDefaultRenderer {...props} />
                          ) : null;
                        },
                      }}
                    />
                  ) : (
                    <Markdown
                      style={markdownDisplayStyles}
                      rules={markdownRules}
                    >
                      {finalRenderedBody}
                    </Markdown>
                  )}
                </Pressable>
              );
            } else {
              return isHtml ? (
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: cleanTextBody }}
                  baseStyle={{
                    color: colors.text,
                    fontSize: isReply ? 14 : 15,
                    marginBottom: 8,
                    lineHeight: isReply ? 20 : undefined,
                  }}
                  enableExperimentalMarginCollapsing
                  tagsStyles={{
                    a: { color: colors.icon },
                    u: { textDecorationLine: 'underline' },
                    ...(isReply && { p: { marginBottom: 12, lineHeight: 20 } }),
                  }}
                  renderers={{
                    video: (props: any) => {
                      const src = props?.tnode?.attributes?.src;
                      const TDefaultRenderer = props?.TDefaultRenderer;
                      if (src && src.endsWith('.mp4')) {
                        return renderMp4Video(src);
                      }
                      return TDefaultRenderer ? (
                        <TDefaultRenderer {...props} />
                      ) : null;
                    },
                  }}
                />
              ) : (
                <Markdown
                  style={markdownDisplayStyles}
                  rules={markdownRules}
                >
                  {finalRenderedBody}
                </Markdown>
              );
            }
          })()}
        {/* VoteReplyBar - different layouts for compact mode (replies) vs normal mode */}
        {compactMode || isReply ? (
          // Compact mode for replies
          <View style={[styles.voteBar, { marginTop: 8 }]}>
            {onUpvotePress && permlink ? (
              <Pressable
                onPress={() => onUpvotePress({ author, permlink })}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginRight: 4 }]}
                accessibilityRole='button'
                accessibilityLabel='Upvote this snap'
              >
                <FontAwesome
                  name='arrow-up'
                  size={16}
                  color={upvoteColor}
                />
              </Pressable>
            ) : (
              <FontAwesome
                name='arrow-up'
                size={16}
                color={upvoteColor}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[styles.voteCount, { color: colors.text, fontSize: 14 }]}>
              {typeof voteCount === 'number' ? Math.abs(voteCount) : '0'}
            </Text>

            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={{ marginLeft: 12, marginRight: 4 }}
            />
            <Text style={[styles.replyCount, { color: colors.text, fontSize: 14 }]}>
              {replyCount}
            </Text>

            <Text style={[styles.payout, { color: colors.payout, marginLeft: 12, fontSize: 14 }]}>
              ${payout.toFixed(2)}
            </Text>

            <View style={{ flex: 1 }} />

            {/* Edit button - only show for own snaps */}
            {onEditPress && permlink && author === currentUsername && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: 'transparent',
                  opacity: posting || editing ? 0.5 : 1,
                }}
                onPress={() => onEditPress({ author, permlink, body })}
                disabled={posting || editing}
                accessibilityRole='button'
                accessibilityLabel='Edit this snap'
              >
                <FontAwesome name='edit' size={14} color={colors.icon} />
                <Text style={{ marginLeft: 4, fontWeight: 'bold', fontSize: 12, color: colors.icon }}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}

            {onReplyPress && permlink && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: 'transparent',
                  opacity: posting || editing ? 0.5 : 1,
                }}
                onPress={() => onReplyPress(author, permlink)}
                disabled={posting || editing}
                accessibilityRole='button'
                accessibilityLabel='Reply to this snap'
              >
                <FontAwesome name='reply' size={16} color={colors.icon} />
                <Text style={{ marginLeft: 4, fontWeight: 'bold', fontSize: 12, color: colors.icon }}>
                  Reply
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Normal mode for main snaps
          <View style={styles.voteBar}>
            {onUpvotePress && permlink ? (
              <Pressable
                onPress={() => onUpvotePress({ author, permlink })}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole='button'
                accessibilityLabel='Upvote this snap'
              >
                <FontAwesome
                  name='arrow-up'
                  size={18}
                  color={upvoteColor}
                  style={styles.icon}
                />
              </Pressable>
            ) : (
              <FontAwesome
                name='arrow-up'
                size={18}
                color={upvoteColor}
                style={styles.icon}
              />
            )}
            <Text style={[styles.voteCount, { color: colors.text }]}>
              {typeof voteCount === 'number' ? Math.abs(voteCount) : '0'}
            </Text>
            {onSpeechBubblePress ? (
              <Pressable
                onPress={onSpeechBubblePress}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole='button'
                accessibilityLabel='View conversation'
              >
                <FontAwesome
                  name='comment-o'
                  size={18}
                  color={colors.icon}
                  style={styles.icon}
                />
              </Pressable>
            ) : (
              <FontAwesome
                name='comment-o'
                size={18}
                color={colors.icon}
                style={styles.icon}
              />
            )}
            <Text style={[styles.replyCount, { color: colors.text }]}>
              {replyCount}
            </Text>
            {/* Resnap button */}
            {onResnapPress && permlink && canBeResnapped({ author, permlink }) && (
              <Pressable
                onPress={() => onResnapPress(author, permlink)}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.6 : 1,
                    marginLeft: 12,
                    padding: 4,
                  },
                ]}
                accessibilityRole='button'
                accessibilityLabel='Resnap this post'
              >
                <FontAwesome name='retweet' size={18} color={colors.icon} />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Text style={[styles.payout, { color: colors.payout }]}>
              ${payout.toFixed(2)}
            </Text>
            {/* Edit button - only show for own snaps */}
            {onEditPress && permlink && author === currentUsername && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'auto',
                  marginLeft: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: 'transparent',
                  opacity: posting || editing ? 0.5 : 1, // Dim when disabled
                }}
                onPress={() => onEditPress({ author, permlink, body })}
                disabled={posting || editing}
                accessibilityRole='button'
                accessibilityLabel='Edit this snap'
              >
                <FontAwesome name='edit' size={16} color={colors.icon} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontWeight: 'bold',
                    fontSize: 15,
                    color: colors.icon,
                  }}
                >
                  Edit
                </Text>
              </TouchableOpacity>
            )}
            {onReplyPress && permlink && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'auto',
                  marginLeft: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: 'transparent',
                  opacity: posting || editing ? 0.5 : 1, // Dim when disabled
                }}
                onPress={() => onReplyPress(author, permlink)}
                disabled={posting || editing}
                accessibilityRole='button'
                accessibilityLabel='Reply to this snap'
              >
                <FontAwesome name='reply' size={16} color={colors.icon} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontWeight: 'bold',
                    fontSize: 15,
                    color: colors.icon,
                  }}
                >
                  Reply
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Hive Post Previews - Footer Style */}
        {hivePostUrls.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <OptimizedHivePostPreviewRenderer
              postUrls={hivePostUrls}
              colors={{
                bubble: colors.bubble,
                icon: colors.icon,
                text: colors.text,
              }}
              onError={error => {
                console.warn('[Snap] Hive post preview error:', error);
              }}
            />
          </View>
        )}
        {/* Three-dots Action Sheet */}
        <ActionSheet
          visible={moreMenuVisible}
          onClose={() => setMoreMenuVisible(false)}
          items={[
            {
              label: 'Share Snap',
              accessibilityLabel: 'Share snap link',
              onPress: handleShareSnap,
            },
            {
              label: 'Go to Profile',
              accessibilityLabel: 'Go to Profile',
              onPress: () => {
                setMoreMenuVisible(false);
                if (onUserPress) {
                  onUserPress(snap.author);
                }
              },
            },
            {
              label: 'Copy to Clipboard',
              accessibilityLabel: 'Copy snap content to clipboard',
              onPress: handleCopyToClipboard,
            },
            {
              label: 'Report Content',
              tone: 'danger',
              accessibilityLabel: 'Report Content',
              onPress: () => {
                setMoreMenuVisible(false);
                setModerationVisible(true);
              },
            },
          ]}
          colors={{ bubble: colors.bubble, border: colors.border, text: colors.text }}
        />
        {/* Moderation Request Modal (Mock) */}
        <ModerationRequestModal
          visible={moderationVisible}
          onClose={() => setModerationVisible(false)}
          onSubmit={handleSubmitModeration}
          colors={colors}
        />
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    width: '100%', // Ensure full width
    alignSelf: 'stretch',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minWidth: 0,
  },
  topRightCluster: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#E1E8ED',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 8,
    maxWidth: `${USERNAME_MAX_WIDTH_PCT * 100}%`,
  },
  timestamp: {
    fontSize: 13,
    opacity: 0.7,
    maxWidth: TIMESTAMP_MAX_WIDTH,
  },
  body: {
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 2,
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginRight: 4,
  },
  voteCount: {
    marginRight: 12,
    fontSize: 14,
  },
  replyCount: {
    marginRight: 12,
    fontSize: 14,
  },
  payout: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.95,
    height: height * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});

export default Snap;
