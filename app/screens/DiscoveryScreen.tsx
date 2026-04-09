import React, { useEffect, useState, useCallback } from 'react';
import { accountStorageService } from '../../services/AccountStorageService';
import { useColorScheme, StyleSheet } from 'react-native';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarService } from '../../services/AvatarService';
import { useHiveData } from '../../hooks/useHiveData';
import { useUpvote } from '../../hooks/useUpvote';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Snap from '../components/Snap';
import { getClient } from '../../services/HiveClient';
import UpvoteModal from '../../components/UpvoteModal';

// Use local twitterColors definition (copied from FeedScreen)
const twitterColors = {
  light: {
    background: '#fff',
    text: '#14171A',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#AAB8C2',
    icon: '#657786',
    fab: '#1DA1F2',
    fabIcon: '#fff',
    border: '#E1E8ED',
    username: '#1DA1F2',
    reward: '#FFD700',
    error: '#FF3B30',
    footer: '#F5F8FA',
    bubble: '#f0f0f0',
  },
  dark: {
    background: '#15202B',
    text: '#fff',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#38444D',
    icon: '#8899A6',
    fab: '#1DA1F2',
    fabIcon: '#fff',
    border: '#38444D',
    username: '#1DA1F2',
    reward: '#FFD700',
    error: '#FF3B30',
    footer: '#22303C',
    bubble: '#192734',
  },
};

const client = getClient();

interface Snap {
  [key: string]: any;
}

const AVATAR_CACHE_TTL = 1000 * 60 * 60 * 24 * 3; // 3 days (legacy; service handles caching)

const DiscoveryScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = twitterColors[colorScheme];
  const router = useRouter();
  const { hashtag } = useLocalSearchParams<{ hashtag: string }>();

  // Get current username
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCache, setAvatarCache] = useState<{ [username: string]: { url: string; ts: number } }>({});

  // Removed useEdit hook - now using ComposeScreen for edit

  // Avatar helper (deterministic); service will be used to warm/update
  const getAvatarUrl = (username: string) => `https://images.hive.blog/u/${username}/avatar/original`;

  // Load legacy avatar cache (optional); will be superseded by service updates
  useEffect(() => {
    (async () => {
      try {
        const cacheStr = await AsyncStorage.getItem('hivesnaps_avatar_cache');
        if (cacheStr) setAvatarCache(JSON.parse(cacheStr));
      } catch { }
    })();
  }, []);

  // Save avatar cache to AsyncStorage when it changes
  useEffect(() => {
    AsyncStorage.setItem(
      'hivesnaps_avatar_cache',
      JSON.stringify(avatarCache)
    ).catch(() => { });
  }, [avatarCache]);

  // Refactor: extract fetchHashtagSnaps for reuse, accept username as parameter
  const fetchHashtagSnaps = async (currentUsername?: string) => {
    setLoading(true);
    try {
      // Get more container posts to ensure good hashtag coverage
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [{ tag: 'peak.snaps', limit: 15 }]
      );
      let allSnaps: Snap[] = [];
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call(
            'get_content_replies',
            [post.author, post.permlink]
          );
          // Filter snaps containing the hashtag (more precise matching)
          return replies.filter(reply => {
            if (!reply.body || !hashtag) return false;
            const body = reply.body.toLowerCase();
            const tag = hashtag.toLowerCase();
            // Match hashtag at word boundaries to avoid partial matches
            const hashtagRegex = new RegExp(`\\B#${tag}\\b`, 'i');
            return hashtagRegex.test(reply.body);
          });
        } catch {
          return [];
        }
      });
      const snapResults = await Promise.all(snapPromises);
      allSnaps = snapResults.flat();
      // Sort by created date descending
      allSnaps.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      // Limit results for better performance (show most recent 30 hashtag matches)
      const limitedSnaps = allSnaps.slice(0, 30);
      console.log(
        `[DiscoveryScreen] Found ${allSnaps.length} snaps with hashtag #${hashtag}, showing ${limitedSnaps.length}`
      );

      // Prepare avatars via service: immediate deterministic URL and background preload
      const now = Date.now();
      const uniqueAuthors = Array.from(new Set(limitedSnaps.map(s => s.author)));
      const newCache = { ...avatarCache };
      for (const u of uniqueAuthors) {
        const cached = avatarService.getCachedAvatarUrl(u);
        newCache[u] = { url: cached || getAvatarUrl(u), ts: now };
      }
      setAvatarCache(newCache);
      avatarService.preloadAvatars(uniqueAuthors).catch(() => { });

      // Attach avatarUrl and hasUpvoted to each snap
      const snapsWithAvatars = limitedSnaps.map(snap => {
        const hasUpvoted =
          Array.isArray(snap.active_votes) &&
          currentUsername &&
          snap.active_votes.some(
            (v: any) => v.voter === currentUsername && v.percent > 0
          );
        const chosenUrl = newCache[snap.author]?.url || getAvatarUrl(snap.author);
        try {
          console.log(
            `[Avatar][Discovery] ${snap.author} -> ${chosenUrl || 'EMPTY'}`
          );
        } catch { }
        return {
          ...snap,
          avatarUrl: chosenUrl,
          hasUpvoted: !!hasUpvoted,
        };
      });
      setSnaps(snapsWithAvatars);
    } catch (err) {
      setSnaps([]);
    }
    setLoading(false);
  };

  // Load username from SecureStore before fetching snaps
  useEffect(() => {
    const loadUsernameAndFetch = async () => {
      const storedUsername = await accountStorageService.getCurrentAccountUsername();
      if (storedUsername) setCurrentUsername(storedUsername);
      // Only pass string or undefined, never null
      if (hashtag) fetchHashtagSnaps(storedUsername ?? undefined);
    };
    loadUsernameAndFetch();
  }, [hashtag]);

  // Create refresh handler that uses current username
  const handleRefresh = async () => {
    const currentUsername = await accountStorageService.getCurrentAccountUsername();
    fetchHashtagSnaps(currentUsername ?? undefined);
  };

  const { medianPrice, rewardFund } = useHiveData();

  const updateSnapInList = useCallback((author: string, permlink: string, updates: any) => {
    setSnaps(prevSnaps =>
      prevSnaps.map(snap => {
        if (snap.author === author && snap.permlink === permlink) {
          return { ...snap, ...updates, hasUpvoted: true };
        }
        return snap;
      })
    );
  }, []);

  const {
    upvoteModalVisible,
    voteWeight,
    voteWeightLoading,
    upvoteLoading,
    upvoteSuccess,
    voteValue,
    openUpvoteModal,
    closeUpvoteModal,
    setVoteWeight,
    confirmUpvote,
  } = useUpvote(currentUsername, rewardFund, medianPrice, updateSnapInList);

  const handleUpvotePress = ({ author, permlink }: { author: string; permlink: string }) => {
    const snap = snaps.find(s => s.author === author && s.permlink === permlink);
    openUpvoteModal({ author, permlink, snap });
  };

  // Handle edit press
  const handleEditPress = (snapData: {
    author: string;
    permlink: string;
    body: string;
  }) => {
    router.push({
      pathname: '/screens/ComposeScreen',
      params: {
        mode: 'edit',
        parentAuthor: snapData.author,
        parentPermlink: snapData.permlink,
        initialText: snapData.body
      }
    });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
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

      {/* Header with back arrow */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name='arrow-left' size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>
          #{hashtag} Snaps
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size='large'
          color={colors.button}
          style={{ marginTop: 40 }}
        />
      ) : snaps.length === 0 ? (
        <Text
          style={{ color: colors.text, marginTop: 24, textAlign: 'center' }}
        >
          No snaps found for this hashtag.
        </Text>
      ) : (
        <FlatList
          data={snaps}
          keyExtractor={item => item.author + '-' + item.permlink}
          renderItem={({ item }) => {
            // Create snap object from discovery item
            const snapData = {
              author: item.author,
              avatarUrl: item.avatarUrl,
              body: item.body,
              created: item.created,
              voteCount: item.net_votes || 0,
              replyCount: item.children || 0,
              payout: parseFloat(
                item.pending_payout_value
                  ? item.pending_payout_value.replace(' HBD', '')
                  : '0'
              ),
              permlink: item.permlink,
              hasUpvoted: item.hasUpvoted,
              community: typeof (item as any).category === 'string' && /^hive-\d+$/i.test((item as any).category) ? (item as any).category : undefined,
              // Include metadata fields needed for HiveSnaps badge detection
              json_metadata: item.json_metadata,
              posting_json_metadata: item.posting_json_metadata,
            };

            return (
              <Snap
                snap={snapData}
                onUpvotePress={handleUpvotePress}
                onSpeechBubblePress={() => {
                  router.push({
                    pathname: '/screens/ConversationScreen',
                    params: { author: item.author, permlink: item.permlink },
                  });
                }}
                onContentPress={() => {
                  router.push({
                    pathname: '/screens/ConversationScreen',
                    params: { author: item.author, permlink: item.permlink },
                  });
                }}
                onUserPress={username => {
                  router.push(`/screens/ProfileScreen?username=${username}` as any);
                }}
                showAuthor
                onHashtagPress={tag => {
                  router.push({
                    pathname: '/screens/DiscoveryScreen',
                    params: { hashtag: tag },
                  });
                }}
                onEditPress={handleEditPress}
                onResnapPress={(author, permlink) => {
                  const snapUrl = `https://hive.blog/@${author}/${permlink}`;
                  router.push({
                    pathname: '/screens/ComposeScreen',
                    params: { resnapUrl: snapUrl },
                  });
                }}
                currentUsername={currentUsername}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: 80 }}
          style={{ width: '100%' }}
          refreshing={loading}
          onRefresh={handleRefresh}
        />
      )}

      {/* Edit Modal removed - now using ComposeScreen */}
    </View>
  );
};

// Header styles (copied from ConversationScreen)
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
});

export default DiscoveryScreen;
