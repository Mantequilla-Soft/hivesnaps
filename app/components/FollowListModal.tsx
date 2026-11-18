import React from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { getAvatarImageUrl } from '../../services/AvatarService';
import { useFollowList } from '../../hooks/useFollowList';
import type { FollowListKind } from '../../utils/followList';
import { useAppColors } from '../styles/colors';

interface FollowListModalProps {
  visible: boolean;
  username: string;
  kind: FollowListKind;
  /** Count from the profile, shown in the title. */
  total?: number;
  /** Logged-in user; enables Follow / Unfollow on each row. */
  currentUsername?: string | null;
  /** Called on close if the user followed or unfollowed anyone from the list. */
  onFollowChange?: () => void;
  onClose: () => void;
}

/**
 * A profile's followers or following, opened by tapping the counts.
 * Loads 100 accounts at a time (alphabetical) and fetches more on scroll.
 * When logged in, each row has Follow / Unfollow, based on the full list of
 * accounts the current user follows.
 */
const FollowListModal: React.FC<FollowListModalProps> = ({
  visible,
  username,
  kind,
  total,
  currentUsername,
  onFollowChange,
  onClose,
}) => {
  const colors = useAppColors();
  const router = useRouter();
  const {
    names,
    loading,
    error,
    loadMore,
    retry,
    myFollowingError,
    retryMyFollowing,
    followState,
    pending,
    toggleFollow,
  } = useFollowList(username, kind, currentUsername, visible, onFollowChange);

  const onToggleFollow = (name: string): void => {
    const following = followState(name) === 'following';
    toggleFollow(name).catch((err) => {
      console.warn('[FollowListModal] Follow toggle failed:', err);
      Alert.alert(
        following ? 'Unfollow failed' : 'Follow failed',
        err instanceof Error ? err.message : 'Please try again.'
      );
    });
  };

  const openProfile = (name: string): void => {
    onClose();
    router.push({ pathname: '/screens/ProfileScreen', params: { username: name } });
  };

  const title = kind === 'followers' ? 'Followers' : 'Following';
  const initialLoad = loading && names.length === 0;

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Close ${title.toLowerCase()} list`} />
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {title}
            {typeof total === 'number' ? ` (${total.toLocaleString()})` : ''}
          </Text>
          {myFollowingError && (
            <Pressable
              onPress={retryMyFollowing}
              style={styles.notice}
              accessibilityRole='button'
              accessibilityLabel='Retry loading follow buttons'
            >
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                Couldn&apos;t load follow buttons ·{' '}
                <Text style={{ color: colors.button }}>Retry</Text>
              </Text>
            </Pressable>
          )}

          {initialLoad ? (
            <ActivityIndicator style={styles.status} color={colors.button} />
          ) : error && names.length === 0 ? (
            <View style={styles.status}>
              <Text style={[styles.emptyText, { color: colors.text }]}>Couldn&apos;t load {title.toLowerCase()}</Text>
              <Pressable onPress={retry} accessibilityRole='button' accessibilityLabel={`Retry loading ${title.toLowerCase()}`}>
                <Text style={[styles.retry, { color: colors.button }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={names}
              keyExtractor={(n) => n}
              style={styles.list}
              onEndReachedThreshold={0.5}
              onEndReached={loadMore}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => openProfile(item)}
                  accessibilityRole='button'
                  accessibilityLabel={`Open @${item}'s profile`}
                >
                  <Image
                    source={{ uri: getAvatarImageUrl(item) }}
                    style={styles.avatar}
                    contentFit='cover'
                    cachePolicy='memory-disk'
                  />
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    @{item}
                  </Text>
                  {currentUsername && item !== currentUsername && followState(item) !== 'unknown' && (
                    <FollowToggle
                      following={followState(item) === 'following'}
                      busy={pending.has(item)}
                      onPress={() => onToggleFollow(item)}
                      username={item}
                      colors={colors}
                    />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  {kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </Text>
              }
              ListFooterComponent={
                loading ? (
                  <ActivityIndicator style={styles.footer} color={colors.button} />
                ) : error ? (
                  <Pressable onPress={retry} style={styles.footer} accessibilityRole='button'>
                    <Text style={[styles.retry, { color: colors.button }]}>Couldn&apos;t load more · Retry</Text>
                  </Pressable>
                ) : null
              }
            />
          )}

          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.button }]}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close'
          >
            <Text style={[styles.closeButtonText, { color: colors.buttonText }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default FollowListModal;

const FollowToggle: React.FC<{
  following: boolean;
  busy: boolean;
  username: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
}> = ({ following, busy, username, onPress, colors }) => (
  <Pressable
    onPress={onPress}
    disabled={busy}
    hitSlop={6}
    style={({ pressed }) => [
      styles.toggle,
      following
        ? { borderColor: colors.unfollowButton, borderWidth: 1 }
        : { backgroundColor: colors.followButton },
      { opacity: pressed || busy ? 0.6 : 1 },
    ]}
    accessibilityRole='button'
    accessibilityLabel={following ? `Unfollow @${username}` : `Follow @${username}`}
  >
    {busy ? (
      <ActivityIndicator size='small' color={following ? colors.unfollowButton : colors.buttonText} />
    ) : (
      <Text style={[styles.toggleText, { color: following ? colors.unfollowButton : colors.buttonText }]}>
        {following ? 'Unfollow' : 'Follow'}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  status: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    // Placeholder circle for accounts without a profile picture.
    backgroundColor: 'rgba(127, 127, 127, 0.15)',
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  toggle: {
    minWidth: 84,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notice: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    opacity: 0.6,
  },
  retry: {
    fontWeight: '600',
    fontSize: 15,
  },
  closeButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
