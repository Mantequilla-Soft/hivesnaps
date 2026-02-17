/**
 * Reusable component for displaying rich Hive post previews
 * Used across FeedScreen, ConversationScreen, and DiscoveryScreen
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  useColorScheme,
  Dimensions,
  Linking,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HivePostInfo } from '../utils/extractHivePostInfo';
import { formatDistanceToNow } from 'date-fns';
import { getHivePostPreviewNavigationInfo } from '../utils/extractHivePostInfo';
import { getTheme, palette } from '../constants/Colors';

interface HivePostPreviewProps {
  postInfo: HivePostInfo;
  style?: any;
}

export const HivePostPreview: React.FC<HivePostPreviewProps> = ({
  postInfo,
  style,
}) => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;

  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.bubble,
    border: theme.border,
    text: theme.text,
    textSecondary: theme.textSecondary,
    icon: theme.icon,
    payout: theme.payout,
    accent: isDark ? palette.primaryDark : palette.primary,
  };

  // Format relative time
  const getRelativeTime = (createdAt: string): string => {
    try {
      const date = new Date(createdAt + 'Z'); // Ensure UTC parsing
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  const handlePress = async () => {
    try {
      // Check if this post is a snap and get navigation info
      const navigationInfo = await getHivePostPreviewNavigationInfo(
        postInfo.originalUrl
      );

      if (navigationInfo) {
        console.log('[HivePostPreview] Navigating to:', navigationInfo.route);
        // Navigate to the appropriate screen based on post type
        router.push({
          pathname: navigationInfo.route as any,
          params: {
            author: postInfo.author,
            permlink: postInfo.permlink,
          },
        });
      } else {
        // Fallback to HivePostScreen if we can't determine the type
        console.log('[HivePostPreview] Fallback to HivePostScreen');
        router.push({
          pathname: '/screens/HivePostScreen',
          params: {
            author: postInfo.author,
            permlink: postInfo.permlink,
          },
        });
      }
    } catch (error) {
      console.error(
        '[HivePostPreview] Error determining navigation route:',
        error
      );
      // Fallback to HivePostScreen on error
      router.push({
        pathname: '/screens/HivePostScreen',
        params: {
          author: postInfo.author,
          permlink: postInfo.permlink,
        },
      });
    }
  };

  const handleExternalLinkPress = (e: any) => {
    e.stopPropagation();
    // Open original URL in browser
    if (postInfo.originalUrl) {
      Linking.openURL(postInfo.originalUrl).catch(err => {
        console.error('Failed to open URL:', err);
      });
    }
  };

  const handleAuthorPress = (e: any) => {
    e.stopPropagation();
    // Navigate to author's profile
    router.push(`/screens/ProfileScreen?username=${postInfo.author}` as any);
  };

  return (
    <Pressable
      style={[
        {
          backgroundColor: colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          marginVertical: 8,
        },
        style,
      ]}
      onPress={handlePress}
      android_ripple={{ color: colors.border }}
      accessibilityRole='button'
      accessibilityLabel={`Hive post: ${postInfo.title} by ${postInfo.author}`}
    >
      {/* Header with site indicator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <FontAwesome
            name='external-link'
            size={12}
            color={colors.textSecondary}
          />
          <Text
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginLeft: 4,
              fontWeight: '500',
            }}
          >
            {postInfo.originalUrl.includes('snapie.io')
              ? 'Snapie'
              : postInfo.originalUrl.includes('ecency.com')
                ? 'Ecency'
                : postInfo.originalUrl.includes('peakd.com')
                  ? 'PeakD'
                  : 'Hive.blog'}
          </Text>
        </View>
        <Pressable onPress={handleExternalLinkPress} hitSlop={8}>
          <FontAwesome name='external-link' size={14} color={colors.accent} />
        </Pressable>
      </View>

      {/* Main content area */}
      <View style={{ paddingHorizontal: 12 }}>
        {/* Post image if available */}
        {postInfo.imageUrl && (
          <View
            style={{
              width: '100%',
              aspectRatio: 2,
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 12,
              backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5',
            }}
          >
            <Image
              source={{ uri: postInfo.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode='cover'
              onError={() => {
                // Silently handle image load errors
              }}
            />
          </View>
        )}

        {/* Post title */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            lineHeight: 20,
            marginBottom: 6,
          }}
          numberOfLines={2}
          ellipsizeMode='tail'
        >
          {postInfo.title}
        </Text>

        {/* Post summary */}
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 18,
            marginBottom: 12,
          }}
          numberOfLines={3}
          ellipsizeMode='tail'
        >
          {postInfo.summary}
        </Text>

        {/* Author and metadata row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          {/* Author info */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={handleAuthorPress}
            hitSlop={8}
          >
            {postInfo.avatarUrl ? (
              <Image
                source={{ uri: postInfo.avatarUrl }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  marginRight: 8,
                  backgroundColor: colors.border,
                }}
                onError={() => {
                  // Silently handle avatar load errors
                }}
              />
            ) : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  marginRight: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesome
                  name='user'
                  size={10}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.text,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              @{postInfo.author}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
              }}
              numberOfLines={1}
            >
              {getRelativeTime(postInfo.created)}
            </Text>
          </Pressable>

          {/* Category tag if available */}
          {postInfo.category && (
            <View
              style={{
                backgroundColor: isDark ? '#2A3B47' : '#E8F5FE',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: colors.accent,
                  fontWeight: '500',
                }}
              >
                {postInfo.category}
              </Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 8,
          }}
        >
          {/* Left side stats */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <FontAwesome name='arrow-up' size={14} color={colors.icon} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginLeft: 4,
                  fontWeight: '500',
                }}
              >
                {postInfo.voteCount}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <FontAwesome name='comment-o' size={14} color={colors.icon} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginLeft: 4,
                  fontWeight: '500',
                }}
              >
                {postInfo.replyCount}
              </Text>
            </View>
          </View>

          {/* Payout */}
          <Text
            style={{
              fontSize: 12,
              color: colors.payout,
              fontWeight: '600',
            }}
          >
            ${postInfo.payout.toFixed(2)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
