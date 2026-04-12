import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import ImageView from 'react-native-image-viewing';
import { createFeedScreenStyles } from '../../styles/FeedScreenStyles';

// Custom hooks for business logic
import { useAuth } from '../../store/context';
import { useFeedData, FeedFilter } from '../../hooks/useFeedData';
import { useBlogFeed } from '../../hooks/useBlogFeed';
import { useUpvote } from '../../hooks/useUpvote';
import { useSearch } from '../../hooks/useSearch';
import { useHiveData } from '../../hooks/useHiveData';
import { useNotifications } from '../../hooks/useNotifications';
import { useVotingPower } from '../../hooks/useVotingPower';
import { useResourceCredits } from '../../hooks/useResourceCredits';
import { useUserProfile } from '../../hooks/useUserProfile';
import { formatVotingPower } from '../../utils/calculateVotingPower';

// Shared state management
import { useAppStore, useCurrentUser, useAppDebug, useFollowCacheManagement } from '../../store/context';

// Components
import Snap from '../components/Snap';
import { BlogCard } from '../components/BlogCard';
import NotificationBadge from '../components/NotificationBadge';
import SmallButton from '../../components/SmallButton';
import StaticContentModal from '../../components/StaticContentModal';
import UpvoteModal from '../../components/UpvoteModal';
import { addPromiseIfValid } from '../../utils/promiseUtils';
import { subscribeGlobalRefresh } from '../../utils/globalEvents';
import { getTheme } from '../../constants/Colors';


type FeedTab = {
  key: 'blogs' | FeedFilter;
  label: string;
  icon: ComponentProps<typeof FontAwesome>['name'];
  feed: 'blogs' | 'snaps';
};

// Modal content constants
const VP_MODAL_CONTENT = {
  title: 'What is Voting Power (VP)?',
  content: `Voting Power (VP) is a measure of your ability to upvote posts and comments on the Hive blockchain. The higher your VP, the more influence your votes have.

- VP decreases each time you upvote.
- VP regenerates automatically over time (about 20% per day).
- Keeping your VP high means your votes have more impact.

You can see your current VP in the top bar. After upvoting, your VP will drop slightly and recharge over time.`,
};

const RC_MODAL_CONTENT = {
  title: 'What are Resource Credits (RC)?',
  content: `Resource Credits are like digital fuel. You need them to do things on Hive, like posting, voting, or making transactions. Every account has them, and using the network costs a small amount each time.

How can I get more?

• Power Up Hive: The more Hive Power you have, the more RC you get.

• Ask for a Delegation: A friend or community can temporarily boost your RC by delegating Hive Power.

• Use a Faucet or Service: Some apps or websites offer small amounts of RC for free.

Don't worry—RC recharges over time!

Even if you're out of credits, just wait a bit. Your RC will slowly refill, and you'll be able to use Hive again without doing anything else.`,
};

// Loading footer style constants
const LOADING_FOOTER_PADDING_VERTICAL = 20;
const LOADING_TEXT_MARGIN_TOP = 8;
const LOADING_TEXT_FONT_SIZE = 14;
const LOADING_TEXT_OPACITY = 0.7;

// Empty state style constants
const EMPTY_STATE_MARGIN_TOP = 40;
const EMPTY_STATE_PADDING_HORIZONTAL = 24;
const EMPTY_STATE_FONT_SIZE = 16;
const EMPTY_STATE_LINE_HEIGHT = 24;

// Empty state messages by filter
const EMPTY_STATE_MESSAGES = {
  my: "You've been too quiet lately... Why don't you share a little?",
  following: "No snaps from people you follow yet. Check back soon!",
  trending: "Nothing trending right now. Be the first to create something!",
  newest: "No snaps to display.",
} as const;

const FeedScreenRefactored = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Shared state integration
  const { selectors } = useAppStore();
  const currentUser = useCurrentUser();
  const { cacheStats, isAnyLoading: isAppLoading } = useAppDebug();

  // Theme colors from centralized theme
  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    button: theme.button,
    buttonText: theme.buttonText,
    buttonInactive: theme.buttonInactive,
    icon: theme.icon,
    bubble: theme.bubble,
  };

  // Initialize styles
  const styles = createFeedScreenStyles(colors, isDark);

  // Custom hooks for business logic
  // Always use the context username for all logic
  const username = useCurrentUser();
  const { logout } = useAuth();

  // User profile and voting power data
  const {
    avatarUrl,
    hasUnclaimedRewards,
    loading: userLoading,
    refreshProfile,
  } = useUserProfile(username);

  const { votingPower, loading: vpLoading, refreshVotingPower } = useVotingPower();
  const { resourceCredits, loading: rcLoading, refreshResourceCredits } = useResourceCredits(username);

  // Feed data and related functions
  const {
    snaps,
    followingList,
    mutedList,
    loading: feedLoading,
    loadingMore,
    error: feedError,
    currentFilter,
    fetchSnaps,
    refreshSnaps,
    loadMoreSnaps,
    updateSnap,
    fetchAndCacheFollowingList,
    fetchAndCacheMutedList,
    ensureFollowingListCached,
    ensureMutedListCached,
    onScrollPositionChange,
    setFilter,
    getMemoryStats,
    canFetchMore,
    clearContainerMap
  } = useFeedData();

  // Blog feed
  const [activeFeed, setActiveFeed] = useState<'blogs' | 'snaps'>('snaps');
  const {
    posts: blogPosts,
    loading: blogLoading,
    loadingMore: blogLoadingMore,
    error: blogError,
    loadMoreError: blogLoadMoreError,
    fetchPosts: fetchBlogPosts,
    refresh: refreshBlogPosts,
    loadMore: loadMoreBlogPosts,
  } = useBlogFeed();

  const handleBlogEndReached = useCallback(() => {
    if (!blogLoadingMore) {
      loadMoreBlogPosts();
    }
  }, [blogLoadingMore, loadMoreBlogPosts]);

  // Cache management for follow/mute lists
  const { invalidateFollowingCache, invalidateMutedCache } = useFollowCacheManagement();

  // Debug: Track function references and username on every render
  if (__DEV__) {
    console.log('[FeedScreen][DEBUG] Render:', {
      username,
      followingListLength: followingList?.length || 0,
      mutedListLength: mutedList?.length || 0,
      fetchAndCacheFollowingList,
      fetchAndCacheMutedList,
      ensureFollowingListCached,
      ensureMutedListCached,
      fetchAndCacheFollowingList_id: fetchAndCacheFollowingList && fetchAndCacheFollowingList.toString().slice(0, 60),
      fetchAndCacheMutedList_id: fetchAndCacheMutedList && fetchAndCacheMutedList.toString().slice(0, 60),
      ensureFollowingListCached_id: ensureFollowingListCached && ensureFollowingListCached.toString().slice(0, 60),
      ensureMutedListCached_id: ensureMutedListCached && ensureMutedListCached.toString().slice(0, 60),
    });
  }

  // Memoize filtered snaps to avoid re-filtering on every render
  const filteredSnaps = useMemo(() => {
    const filtered = snaps.filter((item) => !mutedList || !mutedList.includes(item.author));
    return filtered;
  }, [snaps, mutedList]);

  // Apply the same muted-list filter to blog posts
  const filteredBlogPosts = useMemo(() => {
    if (!mutedList || mutedList.length === 0) return blogPosts;
    const mutedSet = new Set(mutedList);
    return blogPosts.filter((post) => !mutedSet.has(post.author));
  }, [blogPosts, mutedList]);

  const { medianPrice, rewardFund } = useHiveData();

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
  } = useUpvote(username, rewardFund, medianPrice, updateSnap);

  const {
    query: searchQuery,
    type: searchType,
    results: searchResults,
    loading: searchLoading,
    recentSearches,
    recentHashtags,
    setQuery: setSearchQuery,
    setType: setSearchType,
    search: handleSearch,
    clearResults: clearSearch,
    saveToRecentSearches,
    saveToRecentHashtags,
    removeRecentSearch,
    removeRecentHashtag,
    loadRecentSearches,
  } = useSearch();

  const { unreadCount, refresh: refreshNotifications } = useNotifications(username || null);

  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [vpInfoModalVisible, setVpInfoModalVisible] = useState(false);
  const [rcInfoModalVisible, setRcInfoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{ uri: string }>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  // Global refresh spinner + throttle state
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL_MS = 4000; // Throttle window

  // Refs
  const flatListRef = useRef<FlatList<any>>(null);
  const hasInitialFetch = useRef(false);
  const hasOpenedBlogsRef = useRef(false);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Initial data fetch on mount - only once
  useEffect(() => {
    if (!hasInitialFetch.current) {
      console.log(
        `🎬 [FeedScreen] ===== APP STARTUP - MEMORY MANAGEMENT INITIALIZED =====`
      );
      console.log(`🎬 [FeedScreen] Initial mount - fetching data once`);
      const initialStats = getMemoryStats();
      console.log(
        `📊 [FeedScreen] Initial memory state: ${initialStats.memoryUsage}`
      );
      console.log(
        `🏗️ [FeedScreen] About to fetch snaps using container-pagination strategy...`
      );
      hasInitialFetch.current = true;
      fetchSnaps(false).then(() => {
        // Log memory state after initial fetch
        const postFetchStats = getMemoryStats();
        console.log(
          `📊 [FeedScreen] After initial fetch: ${postFetchStats.memoryUsage}`
        );

        if (postFetchStats.containersInMemory === 0) {
          console.log(
            `⚠️ [FeedScreen] WARNING: No containers created after initial fetch! Container system may not be working.`
          );
        }
      }); // Force fresh fetch on mount
    }
  }, []); // Empty deps - only run once on mount

  // Lazy blog fetch — only load when the user first opens the Blogs tab
  useEffect(() => {
    if (activeFeed === 'blogs' && !hasOpenedBlogsRef.current) {
      hasOpenedBlogsRef.current = true;
      void fetchBlogPosts();
    }
  }, [activeFeed, fetchBlogPosts]);

  // Log filter changes (client-side filtering happens automatically in useFeedData)
  useEffect(() => {
    console.log(`🎯 [FeedScreen] Filter changed to: ${currentFilter} (client-side filtering)`);
  }, [currentFilter]);

  // Fetch following list when username becomes available
  const prevDepsRef = useRef({ username, fetchAndCacheFollowingList, ensureFollowingListCached, fetchAndCacheMutedList, ensureMutedListCached });
  useEffect(() => {
    if (__DEV__) {
      const prev = prevDepsRef.current;
      if (prev.username !== username) {
        console.log('[FeedScreen][DEBUG] username changed:', prev.username, '→', username);
      }
      if (prev.fetchAndCacheFollowingList !== fetchAndCacheFollowingList) {
        console.log('[FeedScreen][DEBUG] fetchAndCacheFollowingList function reference changed');
      }
      if (prev.ensureFollowingListCached !== ensureFollowingListCached) {
        console.log('[FeedScreen][DEBUG] ensureFollowingListCached function reference changed');
      }
      if (prev.fetchAndCacheMutedList !== fetchAndCacheMutedList) {
        console.log('[FeedScreen][DEBUG] fetchAndCacheMutedList function reference changed');
      }
      if (prev.ensureMutedListCached !== ensureMutedListCached) {
        console.log('[FeedScreen][DEBUG] ensureMutedListCached function reference changed');
      }
      prevDepsRef.current = { username, fetchAndCacheFollowingList, ensureFollowingListCached, fetchAndCacheMutedList, ensureMutedListCached };
    }
    if (username) {
      console.log(`👤 [FeedScreen] Username became available: ${username}`);
      console.log(`👤 [FeedScreen] Fetching following list for offline filtering...`);
      fetchAndCacheFollowingList(username);
      ensureFollowingListCached(username).then(() => {
        console.log(`👤 [FeedScreen] Following list ensured for ${username}`);
      });
      // --- Muted list loading and logging ---
      console.log(`🔇 [FeedScreen] Fetching muted list for offline filtering...`);
      fetchAndCacheMutedList(username);
      ensureMutedListCached(username).then(() => {
        console.log(`� [FeedScreen] Muted list ensured for ${username}`);
      });
    } else {
      console.log(`👤 [FeedScreen] No username yet - waiting for authentication...`);
    }
  }, [username, fetchAndCacheFollowingList, ensureFollowingListCached, fetchAndCacheMutedList, ensureMutedListCached]);

  // Handle when user reaches near the end of the list
  const handleEndReached = () => {
    if (__DEV__) {
      console.log(`\n📜 [FeedScreen] ===== USER REACHED END OF LIST =====`);
      console.log(`📜 [SCROLL-DEBUG] Current filter: ${currentFilter}`);
      console.log(`📜 [SCROLL-DEBUG] Current snaps count: ${snaps.length}`);
      console.log(`📜 [SCROLL-DEBUG] Filtered snaps count: ${filteredSnaps.length}`);
      console.log(`📜 [SCROLL-DEBUG] Feed loading: ${feedLoading}`);
    }

    if (!canFetchMore()) {
      console.log(`⏹️ [FeedScreen] Not fetching more snaps, limit reached`);
      return;
    }

    // Show current memory stats before loading more
    const currentStats = getMemoryStats();
    console.log(
      `📊 [FeedScreen] Memory before load more: ${currentStats.memoryUsage}`
    );

    if (!feedLoading) {
      console.log(
        `🔄 [FeedScreen] Triggering loadMoreSnaps for filter: ${currentFilter} - this may trigger memory cleanup!`
      );
      console.log(`📜 [SCROLL-DEBUG] About to call loadMoreSnaps() - WATCH FOR SCROLL RESET`);

      loadMoreSnaps().then(() => {
        // Log memory stats after loading more
        const newStats = getMemoryStats();
        console.log(
          `📊 [FeedScreen] Memory after load more: ${newStats.memoryUsage}`
        );
        console.log(`📜 [SCROLL-DEBUG] loadMoreSnaps() completed`);
      });
    } else {
      console.log(
        `⏹️ [FeedScreen] Not loading more, loading: ${feedLoading}`
      );
    }
  };

  // Auto-fetch threshold: when filtered feed has too few items to trigger onEndReached naturally
  const AUTO_FETCH_THRESHOLD = 10;

  // Auto-fetch for Following feed when list is too short to trigger onEndReached
  useEffect(() => {
    if (currentFilter === 'following' && !feedLoading && canFetchMore()) {
      const snapCount = filteredSnaps.length;
      console.log(`🎯 [AUTO-FETCH] Following feed has ${snapCount} snaps`);

      // If Following feed has very few snaps, auto-trigger load more
      // This fixes the issue where onEndReached doesn't fire for short lists
      if (snapCount < AUTO_FETCH_THRESHOLD) {
        console.log(`🎯 [AUTO-FETCH] Following feed too short (${snapCount} snaps), calling loadMoreSnaps directly...`);
        // Call loadMoreSnaps directly instead of handleEndReached to avoid scroll reset
        loadMoreSnaps().then(() => {
          console.log(`🎯 [AUTO-FETCH] loadMoreSnaps completed`);
        }).catch((error) => {
          console.log(`🎯 [AUTO-FETCH] loadMoreSnaps failed:`, error);
        });
      }
    }
  }, [currentFilter, filteredSnaps.length, feedLoading, canFetchMore, loadMoreSnaps]);

  // Handle filter button presses
  const handleFilterPress = (filter: FeedFilter) => {
    if (__DEV__) {
      console.log(`\n🎯 [FeedScreen][DEBUG] handleFilterPress called with: ${filter}`);
      console.log(`🎯 [FeedScreen][DEBUG] Current filter: ${currentFilter}`);
      console.log(`🎯 [FeedScreen][DEBUG] Function references: setFilter=${setFilter}`);
    }

    if (filter === currentFilter) {
      return;
    }


    // If switching to "following" filter, ensure following list is cached
    if (filter === 'following' && username) {
      ensureFollowingListCached(username).then(() => {
        setFilter(filter);
      });
    } else {
      // For other filters, change immediately
      setFilter(filter);
    }
  };

  // Handle upvote press
  const handleUpvotePress = async ({
    author,
    permlink,
  }: {
    author: string;
    permlink: string;
  }) => {
    // Find the snap data to pass for optimistic updates
    const snap = snaps.find(
      s => s.author === author && s.permlink === permlink
    );
    openUpvoteModal({ author, permlink, snap });
    // Optimistic UI: immediately mark as upvoted visually if not already
    if (snap && !snap.hasUpvoted) {
      updateSnap(author, permlink, { hasUpvoted: true });
    }
  };

  // Handle image press
  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

  // Unified global refresh (pull-to-refresh)
  const handleGlobalRefresh = async () => {
    const now = Date.now();
    if (globalRefreshing) {
      return;
    }
    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    lastRefreshTimeRef.current = now;

    setGlobalRefreshing(true);
    const ops: Promise<any>[] = [];
    try {
      if (username) {
        // Invalidate follow/mute caches first to ensure fresh data

        invalidateFollowingCache(username);
        invalidateMutedCache(username);

        // Ensure fresh muted and following lists are cached BEFORE refreshing feed

        try {
          await ensureFollowingListCached(username);
          await ensureMutedListCached(username);
          console.log('✅ [FeedScreen] Follow/mute lists refreshed and cached');
        } catch (e) {
          console.warn('[FeedScreen] Error refreshing follow/mute lists (non-blocking):', e);
        }
      }

      // Clear container state to ensure fresh data and resolve refresh delays
      console.log('🧹 [FeedScreen] Clearing container map for fresh state');
      clearContainerMap();

      // Refresh blog feed only if user has opened the tab at least once
      if (activeFeed === 'blogs' || hasOpenedBlogsRef.current) {
        ops.push(refreshBlogPosts());
      }

      // Now refresh feed snaps with fresh muted/following data (returns a promise)
      ops.push(refreshSnaps());

      if (username) {
        // Voting power + profile refreshers are fire-and-forget (not returning promises)
        try { refreshVotingPower(); } catch (e) { console.warn('[FeedScreen] refreshVotingPower error (non-blocking):', e); }
        try { refreshProfile(); } catch (e) { console.warn('[FeedScreen] refreshProfile error (non-blocking):', e); }

        // Resource credits returns a promise
        try {
          const rcPromise = refreshResourceCredits();
          addPromiseIfValid(rcPromise, ops);
        } catch (e) { console.warn('[FeedScreen] refreshResourceCredits error (non-blocking):', e); }

        // Notifications manual refresh returns a promise
        try {
          const notifPromise = refreshNotifications();
          addPromiseIfValid(notifPromise, ops);
        } catch (e) { console.warn('[FeedScreen] refreshNotifications error (non-blocking):', e); }
      }

      // Await all promise-based ops (feed + any async hooks) but don't reject on single failure
      await Promise.allSettled(ops);
      console.log('✅ [FeedScreen] Global refresh complete');
    } catch (err) {
      console.error('❌ [FeedScreen] Global refresh encountered an error:', err);
    } finally {
      setGlobalRefreshing(false);
    }
  };

  // Subscribe to programmatic global refresh events (e.g., notifications marked read)
  useEffect(() => {
    const unsub = subscribeGlobalRefresh(() => {
      // Reuse existing handler which contains throttling and guards
      try { handleGlobalRefresh(); } catch (e) { console.warn('[FeedScreen] Programmatic global refresh failed', e); }
    });
    return () => unsub();
  }, [handleGlobalRefresh]);

  // Handle search modal close
  const handleCloseSearchModal = () => {
    setIsSearchModalVisible(false);
    clearSearch();
  };

  // Handle search submission
  const handleSearchSubmit = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    if (searchType === 'content') {
      const hashtag = searchTerm.startsWith('#')
        ? searchTerm.slice(1)
        : searchTerm;
      const cleanHashtag = hashtag.trim();

      if (cleanHashtag) {
        await saveToRecentHashtags(cleanHashtag);
        router.push(
          `/screens/DiscoveryScreen?hashtag=${encodeURIComponent(cleanHashtag)}`
        );
        setIsSearchModalVisible(false);
        clearSearch();
      }
      return;
    }

    await handleSearch(searchTerm);
  };

  // Handle back button - minimize app instead of logout
  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        // On Android, minimize the app when back is pressed on main feed
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
          return true;
        }
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );
      return () => backHandler.remove();
    }, [])
  );

  // Viewability config for FlatList
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 60,
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      // Track the first visible item for scroll position
      if (viewableItems.length > 0) {
        const firstVisibleIndex = viewableItems[0].index || 0;
        onScrollPositionChange(firstVisibleIndex);
      }
    }
  ).current;

  // Track scroll position for memory management and prefetching (throttled)
  const handleScroll = useRef((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const screenHeight = layoutMeasurement.height;
    const totalHeight = contentSize.height;

    // Calculate approximate current item index based on scroll position
    // Assuming each item is roughly 200-300px tall
    const estimatedItemHeight = 250;
    const currentIndex = Math.floor(scrollY / estimatedItemHeight);

    // Call the memory management function with current index (now throttled internally)
    onScrollPositionChange(currentIndex);

    // Log memory stats much less frequently - every 50 items and only when containers exist
    if (__DEV__ && currentIndex % 50 === 0 && currentIndex > 0) {
      const stats = getMemoryStats();
      if (stats.containersInMemory > 0) {
        const scrollPercent = Math.round(
          (scrollY / (totalHeight - screenHeight)) * 100
        );
        // For Debugging when we need to improve memory management
        // console.log(
        //   `📊 [Scroll] Item ${currentIndex}, ${scrollPercent}% scrolled, Memory: ${stats.memoryUsage}`
        // );
        // console.log(
        //   `📊 [Scroll] Containers: ${stats.containersInMemory}, Total snaps: ${stats.totalSnaps}`
        // );
      }
    }
  }).current;

  // Debug function to manually check memory stats (can be called from console)
  const logMemoryStats = () => {
    const stats = getMemoryStats();
    console.log(`\n🔍 [DEBUG] ===== MANUAL MEMORY STATS CHECK =====`);
    console.log(
      `🔍 [DEBUG] Containers in memory: ${stats.containersInMemory}/4`
    );
    console.log(`🔍 [DEBUG] Total snaps: ${stats.totalSnaps}`);
    console.log(`🔍 [DEBUG] Memory usage: ${stats.memoryUsage}`);
    console.log(`🔍 [DEBUG] Current snaps shown: ${snaps.length}`);

    // Add registry information
    if (stats.registryInfo) {
      console.log(`📝 [DEBUG] === CONTAINER REGISTRY ===`);
      console.log(`📝 [DEBUG] Total tracked: ${stats.registryInfo.totalTracked}`);
      console.log(`📝 [DEBUG] In memory: ${stats.registryInfo.inMemory}`);
      console.log(`📝 [DEBUG] Freed: ${stats.registryInfo.freed}`);
      console.log(`📝 [DEBUG] Registry snaps: ${stats.registryInfo.snapsInRegistry}`);
    }

    console.log(`🔍 [DEBUG] ===== END MEMORY STATS =====\n`);
    return stats;
  };

  // Make the debug function globally available in development
  if (__DEV__) {
    (globalThis as any).logMemoryStats = logMemoryStats;
    // Also add explicit stats logging
    (globalThis as any).showMemoryStats = () => {
      const stats = getMemoryStats();
      console.log(
        `📊 [Manual] ${stats.memoryUsage}, total snaps: ${stats.totalSnaps}`
      );
      return stats;
    };
  }

  // Render footer with loading indicator
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={{
        paddingVertical: LOADING_FOOTER_PADDING_VERTICAL,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <ActivityIndicator size="small" color={colors.icon} />
        <Text style={{
          color: colors.text,
          marginTop: LOADING_TEXT_MARGIN_TOP,
          fontSize: LOADING_TEXT_FONT_SIZE,
          opacity: LOADING_TEXT_OPACITY
        }}>
          Loading more snaps...
        </Text>
      </View>
    );
  };

  // Get contextual empty state message based on current filter
  const getEmptyStateMessage = (): string => {
    return EMPTY_STATE_MESSAGES[currentFilter] || EMPTY_STATE_MESSAGES.newest;
  };

  return (
    <View style={styles.container}>
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

      {/* Top bar */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <Pressable
              onPress={() => {
                if (username) {
                  console.log('Navigating to profile for username:', username);
                  router.push(`/screens/ProfileScreen?username=${username}` as any);
                } else {
                  console.log(
                    'Cannot navigate to profile: username is undefined'
                  );
                }
              }}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
              accessibilityRole='button'
              accessibilityLabel={`View your profile`}
            >
              {userLoading ? (
                <ActivityIndicator
                  size='small'
                  color={colors.text}
                  style={styles.avatar}
                />
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image
                    source={
                      avatarUrl
                        ? { uri: avatarUrl }
                        : require('../../assets/images/generic-avatar.png')
                    }
                    style={styles.avatar}
                  />
                  {hasUnclaimedRewards && (
                    <View
                      style={[
                        styles.rewardIndicator,
                        {
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          backgroundColor: '#FFD700',
                          borderWidth: 1,
                          borderColor: colors.background,
                        },
                      ]}
                    >
                      <FontAwesome name='dollar' size={8} color='#FFF' />
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.username, { color: colors.text }]}>
                {username && username.length > 8
                  ? username.slice(0, 8) + '...'
                  : username}
              </Text>
            </Pressable>

            {username && (vpLoading || rcLoading) ? (
              <ActivityIndicator
                size='small'
                color={colors.button}
                style={styles.creditsIcon}
              />
            ) : username ? (
              <View style={styles.creditsContainer}>
                {/* Voting Power */}
                <SmallButton
                  label='VP:'
                  value={
                    votingPower !== null
                      ? formatVotingPower(votingPower)
                      : '--'
                  }
                  unit='%'
                  colors={colors}
                  onPress={() => setVpInfoModalVisible(true)}
                  accessibilityLabel='Show Voting Power info'
                  accessibilityRole='button'
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />

                {/* Separator */}
                <Text style={styles.creditsSeparator}>|</Text>

                {/* Resource Credits */}
                <SmallButton
                  label='RC:'
                  value={
                    resourceCredits !== null ? resourceCredits.toFixed(1) : '--'
                  }
                  unit='%'
                  colors={colors}
                  onPress={() => setRcInfoModalVisible(true)}
                  accessibilityLabel='Show Resource Credits info'
                  accessibilityRole='button'
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Info Modals */}
        <StaticContentModal
          visible={vpInfoModalVisible}
          onClose={() => setVpInfoModalVisible(false)}
          title={VP_MODAL_CONTENT.title}
          content={VP_MODAL_CONTENT.content}
          colors={colors}
          closeButtonAccessibilityLabel='Close Voting Power info'
        />

        <StaticContentModal
          visible={rcInfoModalVisible}
          onClose={() => setRcInfoModalVisible(false)}
          title={RC_MODAL_CONTENT.title}
          content={RC_MODAL_CONTENT.content}
          colors={colors}
          closeButtonAccessibilityLabel='Close Resource Credits info'
        />

        {/* Slogan row */}
        <View style={styles.sloganRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/screens/ComposeScreen')}
            accessibilityLabel='Create new snap (slogan)'
          >
            <Text style={[styles.slogan, { color: colors.text }]}>
              What's snappening today?
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.searchBtn, { marginRight: 12 }]}
              onPress={() => setIsSearchModalVisible(true)}
              accessibilityLabel='Search posts and users'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome name='search' size={22} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/screens/NotificationsScreen')}
            >
              <View style={{ position: 'relative' }}>
                <FontAwesome name='bell' size={22} color={colors.icon} />
                <NotificationBadge
                  count={unreadCount}
                  size='small'
                  color='#FF3B30'
                  visible={unreadCount > 0}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Row */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
            style={styles.filterScrollView}
          >
            {(([
              { key: 'blogs', label: 'Blogs', icon: 'newspaper-o', feed: 'blogs' },
              { key: 'following', label: 'Following', icon: 'users', feed: 'snaps' },
              { key: 'newest', label: 'Newest', icon: 'clock-o', feed: 'snaps' },
              { key: 'trending', label: 'Trending', icon: 'fire', feed: 'snaps' },
              { key: 'my', label: 'My Snaps', icon: 'user', feed: 'snaps' },
            ]) as FeedTab[]).map((filter, index) => {
              const isActive = filter.key === 'blogs'
                ? activeFeed === 'blogs'
                : activeFeed === 'snaps' && currentFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterBtnScrollable,
                    {
                      backgroundColor: isActive ? colors.button : colors.buttonInactive,
                      marginLeft: index === 0 ? 0 : 8,
                    },
                  ]}
                  onPress={() => {
                    if (filter.key === 'blogs') {
                      setActiveFeed('blogs');
                    } else {
                      setActiveFeed('snaps');
                      handleFilterPress(filter.key as FeedFilter);
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <FontAwesome
                    name={filter.icon}
                    size={16}
                    color={isActive ? colors.buttonText : colors.text}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.filterTextScrollable,
                      { color: isActive ? colors.buttonText : colors.text },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Feed list */}
      <View style={styles.feedContainer}>
        {activeFeed === 'blogs' ? (
          blogLoading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <ActivityIndicator size="large" color={colors.button} />
              <Text style={{ color: colors.text, fontSize: 16, marginTop: 12 }}>
                Loading blogs...
              </Text>
            </View>
          ) : blogError && filteredBlogPosts.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
              <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>
                {blogError}
              </Text>
            </View>
          ) : (
            <FlatList
              key="blogs-feed"
              data={filteredBlogPosts}
              keyExtractor={(item) => `${item.author}-${item.permlink}`}
              renderItem={({ item }) => (
                <BlogCard
                  post={item}
                  onPress={() => router.push({
                    pathname: '/screens/HivePostScreen',
                    params: { author: item.author, permlink: item.permlink },
                  })}
                  onAuthorPress={(u) => router.push({
                    pathname: '/screens/ProfileScreen',
                    params: { username: u },
                  })}
                />
              )}
              ListHeaderComponent={
                blogError && filteredBlogPosts.length > 0 ? (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                    <Text style={{ color: colors.text, fontSize: 13, textAlign: 'center', opacity: 0.7 }}>
                      Refresh failed — showing cached posts
                    </Text>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
              onEndReached={handleBlogEndReached}
              onEndReachedThreshold={0.3}
              refreshing={globalRefreshing}
              onRefresh={handleGlobalRefresh}
              ListFooterComponent={
                blogLoadingMore ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.button} />
                  </View>
                ) : blogLoadMoreError ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center', paddingHorizontal: 24 }}>
                    <Text style={{ color: colors.text, fontSize: 13, textAlign: 'center' }}>
                      {blogLoadMoreError}
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
                  <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>
                    No blog posts yet. Be the first!
                  </Text>
                </View>
              }
            />
          )
        ) : feedLoading ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <FontAwesome
              name='hourglass-half'
              size={48}
              color={colors.icon}
              style={{
                marginBottom: 12,
                transform: [{ rotate: `${(Date.now() % 3600) / 10}deg` }],
              }}
            />
            <Text style={{ color: colors.text, fontSize: 16 }}>
              Loading snaps...
            </Text>
          </View>
        ) : filteredSnaps.length === 0 ? (
          <View style={{
            alignItems: 'center',
            marginTop: EMPTY_STATE_MARGIN_TOP,
            paddingHorizontal: EMPTY_STATE_PADDING_HORIZONTAL
          }}>
            <Text style={{
              color: colors.text,
              fontSize: EMPTY_STATE_FONT_SIZE,
              textAlign: 'center',
              lineHeight: EMPTY_STATE_LINE_HEIGHT
            }}>
              {getEmptyStateMessage()}
            </Text>
          </View>
        ) : (
          <FlatList
            key="snaps-feed"
            ref={flatListRef}
            data={filteredSnaps}
            keyExtractor={(item, index) =>
              `${item.author}-${item.permlink}-${index}`
            }
            renderItem={({ item }) => {
              // Create snap object from feed item
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
                hasUpvoted: Array.isArray(item.active_votes) &&
                  item.active_votes.some(
                    (v: any) => v.voter === username && v.percent > 0
                  ),
                community: typeof (item as any).category === 'string' && /^hive-\d+$/i.test((item as any).category) ? (item as any).category : undefined,
                // Include metadata fields needed for HiveSnaps badge detection
                json_metadata: item.json_metadata,
                posting_json_metadata: item.posting_json_metadata,
              };

              return (
                <Snap
                  snap={snapData}
                  onUpvotePress={() =>
                    handleUpvotePress({
                      author: item.author,
                      permlink: item.permlink,
                    })
                  }
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
                  onImagePress={handleImagePress}
                  showAuthor
                  onHashtagPress={tag => {
                    router.push({
                      pathname: '/screens/DiscoveryScreen',
                      params: { hashtag: tag },
                    });
                  }}
                  onResnapPress={(author, permlink) => {
                    const snapUrl = `https://hive.blog/@${author}/${permlink}`;
                    router.push({
                      pathname: '/screens/ComposeScreen',
                      params: { resnapUrl: snapUrl },
                    });
                  }}
                />
              );
            }}
            contentContainerStyle={{ paddingBottom: 80 }}
            style={{ width: '100%' }}
            refreshing={feedLoading || globalRefreshing}
            onRefresh={handleGlobalRefresh}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({
                offset: Math.max(0, index - 2) * 220,
                animated: true,
              });
            }}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            onScroll={handleScroll}
            scrollEventThrottle={16} // Throttle scroll events for performance
          />
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.button,
            shadowColor: colorScheme === 'dark' ? '#000' : '#1DA1F2',
            bottom: insets.bottom + 24,
            right: insets.right + 24,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => router.push('/screens/ComposeScreen' as any)}
        accessibilityLabel='Create new snap'
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Image Modal */}
      <ImageView
        images={modalImages}
        imageIndex={modalImageIndex}
        visible={imageModalVisible}
        onRequestClose={() => {
          setImageModalVisible(false);
        }}
        backgroundColor='rgba(0, 0, 0, 0.95)'
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        presentationStyle='fullScreen'
        HeaderComponent={() => (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setImageModalVisible(false)}
            accessibilityLabel='Close image'
          >
            <FontAwesome name='close' size={20} color='#fff' />
          </TouchableOpacity>
        )}
      />

      {/* Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View style={styles.searchModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.searchContainer}
          >
            {/* Search Header */}
            <View style={styles.searchHeader}>
              <Text style={styles.searchHeaderTitle}>Search</Text>
              <TouchableOpacity
                style={styles.searchCloseBtn}
                onPress={() => setIsSearchModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={
                  searchType === 'content'
                    ? 'Search hashtags like photography, crypto...'
                    : 'Search users...'
                }
                placeholderTextColor={colors.text + '60'}
                value={
                  searchType === 'content' &&
                    searchQuery &&
                    !searchQuery.startsWith('#')
                    ? `#${searchQuery}`
                    : searchQuery
                }
                onChangeText={text => {
                  if (searchType === 'content') {
                    const cleanText = text.startsWith('#')
                      ? text.slice(1)
                      : text;
                    setSearchQuery(cleanText);
                  } else {
                    setSearchQuery(text);
                  }
                }}
                onSubmitEditing={() => handleSearchSubmit()}
                returnKeyType='search'
                autoFocus
              />
            </View>

            {/* Search Filters */}
            <View style={styles.searchFilters}>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'users' && styles.searchFilterBtnActive,
                ]}
                onPress={() => {
                  setSearchType('users');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'users' && styles.searchFilterTextActive,
                  ]}
                >
                  Users
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'content' && styles.searchFilterBtnActive,
                ]}
                onPress={() => {
                  setSearchType('content');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'content' && styles.searchFilterTextActive,
                  ]}
                >
                  Content
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.searchContent}>
              {/* Recent Searches - Users */}
              {!searchQuery &&
                searchType === 'users' &&
                recentSearches.length > 0 && (
                  <View style={styles.recentSearchesSection}>
                    <Text style={styles.recentSearchesTitle}>
                      Recent User Searches
                    </Text>
                    {recentSearches.map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentSearchItem}
                        onPress={() => {
                          setSearchQuery(search);
                          handleSearchSubmit(search);
                        }}
                      >
                        <FontAwesome
                          name='user'
                          size={14}
                          color={colors.icon}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.recentSearchText}>{search}</Text>
                        <TouchableOpacity
                          style={styles.clearRecentBtn}
                          onPress={() => removeRecentSearch(search)}
                        >
                          <Text
                            style={{ color: colors.text + '60', fontSize: 12 }}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              {/* Recent Hashtags - Content */}
              {!searchQuery &&
                searchType === 'content' &&
                recentHashtags.length > 0 && (
                  <View style={styles.recentSearchesSection}>
                    <Text style={styles.recentSearchesTitle}>
                      Recent Hashtags
                    </Text>
                    {recentHashtags.map((hashtag, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentSearchItem}
                        onPress={() => {
                          setSearchQuery(hashtag);
                          handleSearchSubmit(hashtag);
                        }}
                      >
                        <FontAwesome
                          name='hashtag'
                          size={14}
                          color={colors.icon}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.recentSearchText}>#{hashtag}</Text>
                        <TouchableOpacity
                          style={styles.clearRecentBtn}
                          onPress={() => removeRecentHashtag(hashtag)}
                        >
                          <Text
                            style={{ color: colors.text + '60', fontSize: 12 }}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              {/* Search Results */}
              {searchQuery && searchType === 'users' && (
                <View style={styles.searchResults}>
                  <Text style={styles.searchResultsTitle}>Users</Text>

                  {searchLoading ? (
                    <View style={styles.searchLoadingContainer}>
                      <ActivityIndicator size='large' color={colors.button} />
                      <Text style={styles.searchLoadingText}>Searching...</Text>
                    </View>
                  ) : searchResults.users.length === 0 ? (
                    <View style={styles.searchEmptyContainer}>
                      <Text style={styles.searchEmptyText}>
                        No users found for "{searchQuery}"
                      </Text>
                    </View>
                  ) : (
                    searchResults.users.map((result: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.searchResultItem}
                        onPress={() => {
                          router.push(
                            `/screens/ProfileScreen?username=${result.name}` as any
                          );
                          setIsSearchModalVisible(false);
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              result.avatarUrl ||
                              `https://images.hive.blog/u/${result.name}/avatar`,
                          }}
                          style={styles.searchResultAvatar}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultUsername}>
                            @{result.name}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            {result.displayName &&
                              result.displayName !== result.name
                              ? result.displayName
                              : ''}
                          </Text>
                          {result.about && (
                            <Text
                              style={styles.searchResultContent}
                              numberOfLines={1}
                              ellipsizeMode='tail'
                            >
                              {result.about}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Content Search Hint */}
              {searchQuery && searchType === 'content' && (
                <View style={styles.searchResults}>
                  <Text style={styles.searchResultsTitle}>Content Search</Text>
                  <View style={styles.searchEmptyContainer}>
                    <FontAwesome
                      name='hashtag'
                      size={32}
                      color={colors.icon}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={styles.searchEmptyText}>
                      Searching for #{searchQuery}...
                    </Text>
                    <Text
                      style={[
                        styles.searchEmptyText,
                        { fontSize: 14, opacity: 0.7, marginTop: 8 },
                      ]}
                    >
                      This will open the Discovery screen with your hashtag
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

export default FeedScreenRefactored;
