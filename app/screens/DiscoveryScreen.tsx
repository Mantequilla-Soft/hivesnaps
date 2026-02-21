import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { PrivateKey } from '@hiveio/dhive';
import { useColorScheme, StyleSheet } from 'react-native';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
// ContentModal removed - now using ComposeScreen for edit
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarService } from '../../services/AvatarService';
import { calculateVoteValue } from '../../utils/calculateVoteValue';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Snap from '../components/Snap';
import { Client } from '@hiveio/dhive';
import UpvoteModal from '../../components/UpvoteModal';
import { useCurrentUser } from '../../store/context';
// useEdit removed - now using ComposeScreen for edit

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

// Use local client instance (copied from FeedScreen)
const HIVE_NODES = [
  'https://api.hive.blog',
  'https://anyx.io',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

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

  // Get current username from context (managed by PIN system)
  const currentUsername = useCurrentUser();

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

  // Load snaps when hashtag or username changes
  useEffect(() => {
    if (hashtag) {
      fetchHashtagSnaps(currentUsername ?? undefined);
    }
  }, [hashtag, currentUsername]);

  // Create refresh handler that uses current username
  const handleRefresh = async () => {
    fetchHashtagSnaps(currentUsername ?? undefined);
  };

  // Upvote modal state and logic (copied/adapted from FeedScreen)
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{
    author: string;
    permlink: string;
  } | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteWeightLoading, setVoteWeightLoading] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  const [voteValue, setVoteValue] = useState<{
    hbd: string;
    usd: string;
  } | null>(null);
  const [globalProps, setGlobalProps] = useState<any | null>(null);
  const [rewardFund, setRewardFund] = useState<any | null>(null);
  const [hivePrice, setHivePrice] = useState<number>(1);
  // Fetch Hive global properties, reward fund, and price on mount
  useEffect(() => {
    const fetchHiveProps = async () => {
      try {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      } catch (err) {
        setGlobalProps(null);
        setRewardFund(null);
      }
    };
    fetchHiveProps();
    // Fetch HIVE price (reuse logic from FeedScreen if available)
    const fetchHivePrice = async () => {
      try {
        // You may want to use a shared utility for this
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd'
        );
        const data = await res.json();
        setHivePrice(data.hive?.usd || 1);
      } catch {
        setHivePrice(1);
      }
    };
    fetchHivePrice();
    // Remove AsyncStorage username fetch, now handled in hashtag effect
  }, []);

  const handleUpvotePress = async ({
    author,
    permlink,
  }: {
    author: string;
    permlink: string;
  }) => {
    setUpvoteTarget({ author, permlink });
    setVoteWeightLoading(true);
    try {
      // Load last used vote weight if available
      const val = await AsyncStorage.getItem('hivesnaps_vote_weight');
      const weight = val !== null ? Number(val) : 100;
      setVoteWeight(weight);
      // Ensure globalProps and rewardFund are loaded before calculating vote value
      if (!globalProps || !rewardFund) {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      }
      // Calculate vote value if possible
      let accountObj = null;
      if (currentUsername) {
        const accounts = await client.database.getAccounts([currentUsername]);
        accountObj = accounts && accounts[0] ? accounts[0] : null;
      }
      if (accountObj && globalProps && rewardFund) {
        const calcValue = calculateVoteValue(
          accountObj,
          globalProps,
          rewardFund,
          weight,
          hivePrice
        );
        setVoteValue(calcValue);
      } else {
        setVoteValue(null);
      }
    } finally {
      setVoteWeightLoading(false);
      setUpvoteModalVisible(true);
    }
  };

  const handleUpvoteCancel = () => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteValue(null);
    // Do not reset voteWeight, keep last used value
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

  const handleUpvoteConfirm = async () => {
    if (!upvoteTarget) return;
    setUpvoteLoading(true);
    setUpvoteSuccess(false);
    try {
      // Get posting key from SecureStore
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr)
        throw new Error('No posting key found. Please log in again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Ensure user is logged in
      if (!currentUsername) {
        throw new Error('User not logged in. Please log in again.');
      }

      // Broadcast vote
      await client.broadcast.vote(
        {
          voter: currentUsername,
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          weight: voteWeight * 100, // dhive expects 10000 = 100%
        },
        postingKey
      );

      // Persist the vote weight after successful vote
      await AsyncStorage.setItem('hivesnaps_vote_weight', String(voteWeight));

      // Optimistically update UI - add payout calculation (use USD since app displays in dollars)
      const estimatedValueIncrease = voteValue ? parseFloat(voteValue.usd) : 0;
      setSnaps(prevSnaps =>
        prevSnaps.map(snap => {
          if (
            snap.author === upvoteTarget.author &&
            snap.permlink === upvoteTarget.permlink
          ) {
            const currentPayout =
              snap.payout ||
              parseFloat(
                snap.pending_payout_value?.replace(' HBD', '') || '0'
              );
            const newPayout = currentPayout + estimatedValueIncrease;

            return {
              ...snap,
              hasUpvoted: true,
              net_votes: (snap.net_votes || 0) + 1,
              payout: newPayout,
              pending_payout_value: `${newPayout.toFixed(3)} HBD`,
              active_votes: Array.isArray(snap.active_votes)
                ? [
                  ...snap.active_votes,
                  { voter: currentUsername, percent: voteWeight * 100 },
                ]
                : [{ voter: currentUsername, percent: voteWeight * 100 }],
            };
          }
          return snap;
        })
      );

      setUpvoteLoading(false);
      setUpvoteSuccess(true);
      // Close modal without refresh - maintain scroll position!
      setTimeout(() => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        setVoteValue(null);
      }, 1500);
    } catch {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
    }
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
        onClose={handleUpvoteCancel}
        onConfirm={handleUpvoteConfirm}
        onVoteWeightChange={async val => {
          setVoteWeight(val);
          // Live update vote value
          let accountObj = null;
          if (currentUsername) {
            const accounts = await client.database.getAccounts([currentUsername]);
            accountObj = accounts && accounts[0] ? accounts[0] : null;
          }
          if (accountObj && globalProps && rewardFund) {
            const calcValue = calculateVoteValue(
              accountObj,
              globalProps,
              rewardFund,
              val,
              hivePrice
            );
            setVoteValue(calcValue);
          } else {
            setVoteValue(null);
          }
        }}
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
