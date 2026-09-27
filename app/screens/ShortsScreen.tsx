/**
 * Full-screen, vertical, autoplaying Shorts feed — mirrors snapie-io's
 * /shorts page. Sourced from 3Speak's own global shorts pool (see
 * hooks/useShorts.ts / services/shortsService.ts), not a Hive bridge query,
 * same as the web app. Hides all normal app chrome (no header, no
 * BottomTabBar) for full immersion; a single back button returns to
 * wherever the viewer came from.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShorts, ShortWithAvatar } from '../../hooks/useShorts';
import { useCurrentUser } from '../../store/context';
import ShortCard from '../components/ShortCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ShortsScreen() {
  const router = useRouter();
  const currentUsername = useCurrentUser();
  const { shorts, loading, loadingMore, error, hasMore, fetchShorts, loadMore } =
    useShorts(currentUsername);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    fetchShorts();
    // Fetch once per screen mount — a fresh, shuffled session's worth of
    // shorts, not re-triggered by every state change on this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstVisible = viewableItems[0];
      if (firstVisible && firstVisible.index !== null && firstVisible.index !== undefined) {
        setActiveIndex(firstVisible.index);
      }
    }
  ).current;

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore) loadMore();
  }, [hasMore, loadingMore, loadMore]);

  const handleToggleMute = useCallback(() => setMuted(m => !m), []);

  const renderItem = useCallback(
    ({ item, index }: { item: ShortWithAvatar; index: number }) => (
      <ShortCard
        short={item}
        currentUsername={currentUsername}
        isActive={index === activeIndex}
        isPreload={Math.abs(index - activeIndex) === 1}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
    ),
    [activeIndex, muted, currentUsername, handleToggleMute]
  );

  const backButton = (
    <SafeAreaView style={styles.backButtonContainer} pointerEvents='box-none'>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
        accessibilityRole='button'
        accessibilityLabel='Close Shorts'
      >
        <Ionicons name='chevron-back' size={28} color='#fff' />
      </TouchableOpacity>
    </SafeAreaView>
  );

  if (loading && shorts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size='large' color='#fff' />
        {backButton}
      </View>
    );
  }

  if (!loading && shorts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{error || 'No shorts to show right now.'}</Text>
        <TouchableOpacity onPress={fetchShorts} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
        {backButton}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={shorts}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate='fast'
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={handleEndReached}
        onEndReachedThreshold={1.5}
        windowSize={5}
        maxToRenderPerBatch={3}
        removeClippedSubviews
      />

      {backButton}

      {loadingMore ? (
        <View style={styles.loadingMoreIndicator}>
          <ActivityIndicator size='small' color='#fff' />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backButton: {
    margin: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  loadingMoreIndicator: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
});
