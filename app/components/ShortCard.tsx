/**
 * One full-screen Shorts slide: the always-playing video plus the
 * right-rail/bottom interaction overlay (like, comment, share, mute) that
 * snapie-io's ShortCard also shows. Every action here is a real Hive
 * operation (vote broadcast, a real post/comment thread) — not UI-only
 * state — same as the rest of the app.
 *
 * v1 scope: tap-to-like at a fixed 100% weight, and comments open the
 * existing ConversationScreen thread rather than an in-place sheet. A
 * long-press vote-weight slider and an in-place comment drawer (both
 * present in snapie-io's own ShortCard) are deferred as later polish.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PrivateKey } from '@hiveio/dhive';
import ShortVideoPlayer from './ShortVideoPlayer';
import { ShortWithAvatar } from '../../hooks/useShorts';
import { getClient } from '../../services/HiveClient';
import { accountStorageService } from '../../services/AccountStorageService';
import { awardPoints } from '../../services/pointsService';
import { isPointsEnabled } from '../../utils/pointsConfig';
import { buildSnapieUrl } from '../../utils/snapieUrlBuilder';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const client = getClient();

interface ShortCardProps {
  short: ShortWithAvatar;
  currentUsername: string | null;
  isActive: boolean;
  isPreload: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

export default function ShortCard({
  short,
  currentUsername,
  isActive,
  isPreload,
  muted,
  onToggleMute,
}: ShortCardProps) {
  const router = useRouter();
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const loadedStatusRef = useRef(false);

  // Pull real vote/comment state once this card becomes active — mirrors
  // snapie-io calling getPost() on activation so a deep-link or a re-swipe
  // back always shows accurate state, not just what came back from the
  // shorts list endpoint (which has no per-viewer vote info at all).
  useEffect(() => {
    if (!isActive || loadedStatusRef.current) return;
    loadedStatusRef.current = true;

    let cancelled = false;
    client.database
      .call('get_content', [short.author, short.hivePermlink])
      .then((post: any) => {
        if (cancelled || !post) return;
        const votes = Array.isArray(post.active_votes) ? post.active_votes : [];
        setHasVoted(
          !!currentUsername &&
            votes.some((v: any) => v.voter === currentUsername && v.percent > 0)
        );
        setCommentCount(typeof post.children === 'number' ? post.children : null);
      })
      .catch(() => {
        // Leave hasVoted/commentCount at their defaults — non-critical overlay data.
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, short.author, short.hivePermlink, currentUsername]);

  const handleLike = useCallback(async () => {
    if (!currentUsername || voting || hasVoted) return;
    setVoting(true);
    const previousVoted = hasVoted;
    setHasVoted(true); // optimistic

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const postingKeyStr = await accountStorageService.getCurrentPostingKey();
      if (!postingKeyStr) throw new Error('No posting key found.');
      const postingKey = PrivateKey.fromString(postingKeyStr);

      await client.broadcast.vote(
        {
          voter: currentUsername,
          author: short.author,
          permlink: short.hivePermlink,
          weight: 10000,
        },
        postingKey
      );

      if (isPointsEnabled(currentUsername)) {
        awardPoints('vote', currentUsername, short.author, short.hivePermlink);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setHasVoted(previousVoted); // rollback
      console.error('[ShortCard] Vote failed:', err);
    } finally {
      setVoting(false);
    }
  }, [currentUsername, voting, hasVoted, short.author, short.hivePermlink]);

  const handleComment = useCallback(() => {
    router.push({
      pathname: '/screens/ConversationScreen',
      params: { author: short.author, permlink: short.hivePermlink },
    });
  }, [router, short.author, short.hivePermlink]);

  const handleShare = useCallback(async () => {
    const url = buildSnapieUrl(short.author, short.hivePermlink);
    try {
      await Share.share({
        message: url,
        url,
        title: `Check out this short by @${short.author}`,
      });
    } catch {
      // User cancelled the share sheet — nothing to do.
    }
  }, [short.author, short.hivePermlink]);

  const handleAuthorPress = useCallback(() => {
    router.push(`/screens/ProfileScreen?username=${short.author}` as any);
  }, [router, short.author]);

  return (
    <View style={[styles.container, { height: SCREEN_HEIGHT }]}>
      <ShortVideoPlayer
        author={short.author}
        permlink={short.permlink}
        thumbnailUrl={short.thumbnailUrl}
        isActive={isActive}
        isPreload={isPreload}
        muted={muted}
      />

      {/* Bottom-left: author + title */}
      <View style={styles.bottomInfo} pointerEvents='box-none'>
        <TouchableOpacity onPress={handleAuthorPress} style={styles.authorRow}>
          {short.avatarUrl ? (
            <ExpoImage source={{ uri: short.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <Text style={styles.authorText}>@{short.author}</Text>
        </TouchableOpacity>
        {short.title ? (
          <Text style={styles.titleText} numberOfLines={2}>
            {short.title}
          </Text>
        ) : null}
      </View>

      {/* Right rail: like / comment / share / mute */}
      <View style={styles.rightRail} pointerEvents='box-none'>
        <TouchableOpacity style={styles.railButton} onPress={handleLike} disabled={voting}>
          <Ionicons
            name={hasVoted ? 'heart' : 'heart-outline'}
            size={30}
            color={hasVoted ? '#FF3B5C' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.railButton} onPress={handleComment}>
          <Ionicons name='chatbubble-outline' size={28} color='#fff' />
          {commentCount !== null && commentCount > 0 ? (
            <Text style={styles.railLabel}>{commentCount}</Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.railButton} onPress={handleShare}>
          <Ionicons name='arrow-redo-outline' size={28} color='#fff' />
        </TouchableOpacity>

        {isActive ? (
          <TouchableOpacity style={styles.railButton} onPress={onToggleMute}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={26} color='#fff' />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 88,
    bottom: 32,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarFallback: {
    backgroundColor: '#444',
  },
  authorText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  titleText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 40,
    alignItems: 'center',
    gap: 20,
  },
  railButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
});
