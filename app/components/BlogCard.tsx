import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { postBodySummary } from '@ecency/render-helper';
import { getTheme } from '../../constants/Colors';
import type { BlogPost } from '../../hooks/useBlogFeed';

interface BlogCardProps {
  post: BlogPost;
  onPress: () => void;
  onAuthorPress: (username: string) => void;
}

/**
 * Plain-text excerpt of the post body. postBodySummary (from @ecency/render-helper
 * — the same library Ecency's own mobile app uses for this exact purpose) already
 * strips markdown, HTML tags/entities, and embedded video URLs in one pass.
 *
 * It truncates on spaces, so text without spaces (CJK prose, a long hashtag)
 * summarizes to "". Mirror Ecency's own fallback for that case: take the
 * untruncated plain text and cut it by code point instead, so such a body still
 * yields a bounded excerpt.
 */
function buildExcerpt(body: string, maxLen = 140): string {
  const platform = Platform.OS as 'ios' | 'android';
  const summary = postBodySummary(body, maxLen, platform);
  if (summary) return summary;
  const plain = postBodySummary(body, 0, platform);
  return plain ? Array.from(plain as string).slice(0, maxLen).join('') : '';
}

function formatPayout(pendingPayout: string, totalPayout: string): string {
  const pending = parseFloat(pendingPayout);
  const total = parseFloat(totalPayout);
  const value = pending > 0 ? pending : total;
  return isNaN(value) ? '$0.00' : `$${value.toFixed(2)}`;
}

function formatTimeAgo(created: string): string {
  if (!created) return '';
  const diff = Date.now() - new Date(created + 'Z').getTime();
  if (isNaN(diff) || diff < 0) return '';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, onPress, onAuthorPress }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = useMemo(() => getTheme(isDark ? 'dark' : 'light'), [isDark]);

  const excerpt = useMemo(() => buildExcerpt(post.body), [post.body]);
  const payout = useMemo(
    () => formatPayout(post.pending_payout_value, post.total_payout_value),
    [post.pending_payout_value, post.total_payout_value]
  );
  const timeAgo = useMemo(() => formatTimeAgo(post.created), [post.created]);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.bubble, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Blog post: ${post.title} by ${post.author}`}
    >
      {/* Thumbnail */}
      {post.thumbnailUrl ? (
        <Image
          source={{ uri: post.thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.border }]}>
          <FontAwesome name="file-text-o" size={28} color={theme.textSecondary} />
        </View>
      )}

      <View style={styles.body}>
        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {post.title || '(Untitled)'}
        </Text>

        {/* Excerpt */}
        {excerpt.length > 0 && (
          <Text style={[styles.excerpt, { color: theme.textSecondary }]} numberOfLines={2}>
            {excerpt}
          </Text>
        )}

        {/* Footer row */}
        <View style={styles.footer}>
          {/* Author */}
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => onAuthorPress(post.author)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {post.avatarUrl ? (
              <Image source={{ uri: post.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.border }]} />
            )}
            <Text style={[styles.authorName, { color: theme.textSecondary }]}>
              @{post.author}
            </Text>
          </TouchableOpacity>

          {timeAgo ? (
            <>
              <Text style={[styles.dot, { color: theme.textSecondary }]}>·</Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>{timeAgo}</Text>
            </>
          ) : null}

          {/* Stats */}
          <View style={styles.stats}>
            <Text style={[styles.stat, { color: theme.payout }]}>{payout}</Text>
            <View style={styles.statItem}>
              <FontAwesome name="heart-o" size={11} color={theme.textSecondary} />
              <Text style={[styles.stat, { color: theme.textSecondary }]}>{post.net_votes}</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome name="comment-o" size={11} color={theme.textSecondary} />
              <Text style={[styles.stat, { color: theme.textSecondary }]}>{post.children}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  excerpt: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarFallback: {},
  authorName: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stat: {
    fontSize: 12,
    fontWeight: '500',
  },
});
