import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { fetchLeaderboard, LeaderboardEntry } from '../../services/pointsService';

const PAGE_SIZE = 50;

const PointsLeaderboardScreen = (): React.JSX.Element => {
  const theme = useTheme();
  const router = useRouter();
  const { currentUsername } = useAuth();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await fetchLeaderboard(PAGE_SIZE, 0);
      if (cancelled) return;
      setEntries(page.entries);
      setHasMore(page.hasMore);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const page = await fetchLeaderboard(PAGE_SIZE, entries.length);
    setEntries(prev => [...prev, ...page.entries]);
    setHasMore(page.hasMore);
    setLoadingMore(false);
  }, [loadingMore, hasMore, entries.length]);

  const renderItem = useCallback(({ item }: { item: LeaderboardEntry }) => {
    const isSelf = item.username === currentUsername;
    return (
      <View
        style={[
          styles.row,
          { borderBottomColor: theme.border },
          isSelf && { backgroundColor: theme.bubble },
        ]}
      >
        <Text style={[styles.rank, { color: theme.textSecondary }]}>#{item.rank}</Text>
        <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>@{item.username}</Text>
        <Text style={[styles.points, { color: theme.text }]}>{item.lifetimeEarned}</Text>
      </View>
    );
  }, [currentUsername, theme]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <FontAwesome name="chevron-left" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Points Leaderboard</Text>
        <View style={{ width: 18 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loadingIndicator} color={theme.icon} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.username}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingIndicator} color={theme.icon} /> : null}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No one has earned points yet.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default PointsLeaderboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rank: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
  },
  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  points: {
    fontSize: 15,
    fontWeight: '700',
  },
  loadingIndicator: {
    marginTop: 24,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
});
