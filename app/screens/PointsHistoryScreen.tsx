import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { fetchPointsTransactions, type PointsTransaction } from '../../services/pointsService';
import { formatRelativeShort } from '../../utils/time';

type IconName = React.ComponentProps<typeof FontAwesome>['name'];

const TYPE_ICON: Record<string, IconName> = {
  earn: 'star',
  purchase: 'shopping-cart',
  admin_grant: 'gift',
  roulette: 'random',
  badge_purchase: 'certificate',
};

/** "+12" / "-5" with thousands separators. */
function formatDelta(delta: number): string {
  return `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}`;
}

/**
 * Your latest Snapie Points activity (earned, bought, granted, roulette,
 * badges), as on snapie.io's wallet History. The API returns the latest 50.
 */
const PointsHistoryScreen = (): React.JSX.Element => {
  const theme = useTheme();
  const router = useRouter();
  const { currentUsername } = useAuth();

  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!currentUsername) return;
    const request = ++requestRef.current;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await fetchPointsTransactions(currentUsername);
      if (request === requestRef.current) setTransactions(list);
    } catch (err) {
      console.warn('[PointsHistory] load failed:', err);
      if (request === requestRef.current) setError('Couldn’t load your points history.');
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUsername]);

  useEffect(() => {
    load('initial');
  }, [load]);

  const renderItem = useCallback(({ item }: { item: PointsTransaction }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.bubble }]}>
        <FontAwesome name={TYPE_ICON[item.type] ?? 'circle-o'} size={14} color={theme.icon} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, { color: theme.text }]} numberOfLines={2}>{item.label}</Text>
        <Text style={[styles.time, { color: theme.textSecondary }]}>{formatRelativeShort(item.createdAt)}</Text>
      </View>
      <Text style={[styles.delta, { color: item.delta >= 0 ? theme.success : theme.error }]}>{formatDelta(item.delta)}</Text>
    </View>
  ), [theme]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <FontAwesome name="chevron-left" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Points History</Text>
        <View style={{ width: 18 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.status} color={theme.icon} />
      ) : error && transactions.length === 0 ? (
        <TouchableOpacity onPress={() => load('initial')} style={styles.status} accessibilityRole="button">
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {error} <Text style={{ color: theme.button, fontWeight: '600' }}>Retry</Text>
          </Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, index) => `${item.createdAt}-${index}`}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={theme.icon} />}
          ListHeaderComponent={
            error ? <Text style={[styles.message, { color: theme.error }]}>{error}</Text> : null
          }
          ListEmptyComponent={
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              No activity yet. Snaps, comments, votes and reblogs earn points.
            </Text>
          }
          ListFooterComponent={
            transactions.length > 0 ? (
              <Text style={[styles.footer, { color: theme.textSecondary }]}>Showing your latest activity.</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

export default PointsHistoryScreen;

export const options = { headerShown: false };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  label: { fontSize: 15 },
  time: { fontSize: 12, marginTop: 2 },
  delta: { fontSize: 15, fontWeight: '700' },
  status: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  message: { fontSize: 14, textAlign: 'center', padding: 24 },
  footer: { fontSize: 12, textAlign: 'center', paddingVertical: 16 },
});
