import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getClient } from '../../services/HiveClient';
import { getAvatarImageUrl } from '../../services/AvatarService';
import { broadcastFollow } from '../../services/HiveFollowService';
import { useFollowCacheManagement } from '../../store/context';
import { fetchAllFollowing, fetchFollowPage, type FollowListKind } from '../../utils/followList';
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
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const nextStart = useRef('');
  const inFlight = useRef(false);
  const { invalidateFollowingCache } = useFollowCacheManagement();
  /** Accounts the logged-in user follows; null until loaded (buttons hidden). */
  const [myFollowing, setMyFollowing] = useState<Set<string> | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const changed = useRef(false);

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setError(false);
      try {
        const client = getClient();
        const page = await fetchFollowPage(
          (api, method, params) => client.call(api, method, params),
          username,
          kind,
          reset ? '' : nextStart.current
        );
        nextStart.current = page.nextStart;
        setDone(page.done);
        setNames((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base);
          return [...base, ...page.names.filter((n) => !seen.has(n))];
        });
      } catch (err) {
        console.warn(`[FollowListModal] Failed to load ${kind}:`, err);
        setError(true);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [username, kind]
  );

  useEffect(() => {
    if (!visible) return;
    nextStart.current = '';
    setNames([]);
    setDone(false);
    loadPage(true);
  }, [visible, loadPage]);

  useEffect(() => {
    if (!visible || !currentUsername) return;
    let cancelled = false;
    setMyFollowing(null);
    const client = getClient();
    fetchAllFollowing((api, method, params) => client.call(api, method, params), currentUsername)
      .then((set) => {
        if (!cancelled) setMyFollowing(set);
      })
      .catch((err) => console.warn('[FollowListModal] Failed to load your following list:', err));
    return () => {
      cancelled = true;
    };
  }, [visible, currentUsername]);

  const toggleFollow = async (name: string) => {
    if (!currentUsername || !myFollowing || pending.has(name)) return;
    const following = myFollowing.has(name);
    setPending((p) => new Set(p).add(name));
    try {
      await broadcastFollow(currentUsername, name, following ? [] : ['blog']);
      setMyFollowing((prev) => {
        const next = new Set(prev ?? []);
        if (following) next.delete(name);
        else next.add(name);
        return next;
      });
      changed.current = true;
      invalidateFollowingCache(currentUsername);
    } catch (err) {
      console.warn('[FollowListModal] Follow toggle failed:', err);
      Alert.alert(
        following ? 'Unfollow failed' : 'Follow failed',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(name);
        return next;
      });
    }
  };

  const close = () => {
    if (changed.current) {
      changed.current = false;
      onFollowChange?.();
    }
    onClose();
  };

  const openProfile = (name: string) => {
    close();
    router.push({ pathname: '/screens/ProfileScreen', params: { username: name } });
  };

  const title = kind === 'followers' ? 'Followers' : 'Following';
  const initialLoad = loading && names.length === 0;

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={`Close ${title.toLowerCase()} list`} />
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {title}
            {typeof total === 'number' ? ` (${total.toLocaleString()})` : ''}
          </Text>

          {initialLoad ? (
            <ActivityIndicator style={styles.status} color={colors.button} />
          ) : error && names.length === 0 ? (
            <View style={styles.status}>
              <Text style={[styles.emptyText, { color: colors.text }]}>Couldn&apos;t load {title.toLowerCase()}</Text>
              <Pressable onPress={() => loadPage(true)} accessibilityRole='button' accessibilityLabel={`Retry loading ${title.toLowerCase()}`}>
                <Text style={[styles.retry, { color: colors.button }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={names}
              keyExtractor={(n) => n}
              style={styles.list}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (!done && !error) loadPage(false);
              }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => openProfile(item)}
                  accessibilityRole='button'
                  accessibilityLabel={`Open @${item}'s profile`}
                >
                  <Image source={{ uri: getAvatarImageUrl(item) }} style={styles.avatar} />
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    @{item}
                  </Text>
                  {myFollowing && currentUsername && item !== currentUsername && (
                    <FollowToggle
                      following={myFollowing.has(item)}
                      busy={pending.has(item)}
                      onPress={() => toggleFollow(item)}
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
                  <Pressable onPress={() => loadPage(false)} style={styles.footer} accessibilityRole='button'>
                    <Text style={[styles.retry, { color: colors.button }]}>Couldn&apos;t load more · Retry</Text>
                  </Pressable>
                ) : null
              }
            />
          )}

          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.button }]}
            onPress={close}
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
      <ActivityIndicator size='small' color={following ? colors.unfollowButton : '#fff'} />
    ) : (
      <Text style={[styles.toggleText, { color: following ? colors.unfollowButton : '#fff' }]}>
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
