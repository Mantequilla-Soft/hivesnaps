import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getTheme } from '../../constants/Colors';
import type { BlogPost } from '../../hooks/useBlogFeed';

interface BlogCardProps {
  post: BlogPost;
  onPress: () => void;
  onAuthorPress: (username: string) => void;
}

/** Strip markdown and return a plain-text excerpt */
function buildExcerpt(body: string, maxLen = 140): string {
  const stripped = body
    .replace(/!\[.*?\]\(.*?\)/g, '')   // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text
    .replace(/#{1,6}\s*/g, '')          // headings
    .replace(/[*_~`>]/g, '')            // emphasis/code/quote
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen).trimEnd() + '…' : stripped;
}

function formatPayout(pendingPayout: string, totalPayout: string): string {
  const pending = parseFloat(pendingPayout);
  const total = parseFloat(totalPayout);
  const value = pending > 0 ? pending : total;
  return isNaN(value) ? '$0.00' : `$${value.toFixed(2)}`;
}

function formatTimeAgo(created: string): string {
  const diff = Date.now() - new Date(created + 'Z').getTime();
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

          <Text style={[styles.dot, { color: theme.textSecondary }]}>·</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{timeAgo}</Text>

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
