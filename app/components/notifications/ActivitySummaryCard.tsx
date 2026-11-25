import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { Theme } from '../../../constants/Colors';
import {
  SUMMARY_FILTER_LABELS,
  SUMMARY_RANGES,
  type SummaryFilter,
  type SummaryRange,
  type SummaryTile,
} from '../../../utils/notificationSummary';

interface Props {
  theme: Theme;
  range: SummaryRange;
  onRangeChange: (range: SummaryRange) => void;
  tiles: SummaryTile[];
  filter: SummaryFilter | null;
  onTilePress: (filter: SummaryFilter) => void;
  /** Older notifications are still loading to cover the range. */
  backfilling: boolean;
  onClearFilter: () => void;
}

const tileLabel = (t: SummaryTile): string =>
  [`${t.value} ${t.label.toLowerCase()}`, t.detail, t.sub]
    .filter(Boolean)
    .join(', ');

/** "Activity" card: counts for Today / This Week / This Month; a tile filters the list below. */
export const ActivitySummaryCard: React.FC<Props> = ({
  theme,
  range,
  onRangeChange,
  tiles,
  filter,
  onTilePress,
  backfilling,
  onClearFilter,
}) => (
  <View>
    <View
      style={[
        styles.card,
        { backgroundColor: theme.bubble, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>Activity</Text>
          {backfilling && (
            <ActivityIndicator
              size='small'
              color={theme.textSecondary}
              accessibilityLabel='Loading older notifications'
            />
          )}
        </View>
        <View style={styles.ranges}>
          {SUMMARY_RANGES.map(({ key, label }) => {
            const selected = key === range;
            return (
              <Pressable
                key={key}
                onPress={() => onRangeChange(key)}
                style={[
                  styles.range,
                  selected && { backgroundColor: theme.button },
                ]}
                accessibilityRole='button'
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.rangeText,
                    {
                      color: selected ? theme.buttonText : theme.textSecondary,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tiles.length > 0 ? (
        <View style={styles.grid}>
          {tiles.map(t => {
            const selected = filter === t.filter;
            return (
              <Pressable
                key={t.filter}
                onPress={() => onTilePress(t.filter)}
                style={[
                  styles.tile,
                  {
                    borderColor: selected ? t.color : theme.border,
                    backgroundColor: theme.background,
                  },
                  selected && styles.tileSelected,
                ]}
                accessibilityRole='button'
                accessibilityState={{ selected }}
                accessibilityLabel={tileLabel(t)}
                accessibilityHint={
                  selected
                    ? 'Shows all notifications'
                    : `Shows only ${t.label.toLowerCase()}`
                }
              >
                <View
                  style={[styles.tileIcon, { backgroundColor: `${t.color}20` }]}
                >
                  <FontAwesome name={t.icon} size={14} color={t.color} />
                </View>
                <Text style={[styles.tileValue, { color: t.color }]}>
                  {t.value}
                </Text>
                <Text
                  style={[styles.tileLabel, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {t.sub ? (
                  <Text style={[styles.tileSub, { color: t.color }]}>
                    {t.sub}
                  </Text>
                ) : null}
                {t.detail ? (
                  <Text
                    style={[styles.tileDetail, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {t.detail}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          {backfilling
            ? 'Counting your activity…'
            : 'No activity in this range yet.'}
        </Text>
      )}
    </View>
    {/* Always offered while filtering: the tile itself may not be in the current range. */}
    {filter ? (
      <Pressable
        onPress={onClearFilter}
        style={styles.filterBar}
        accessibilityRole='button'
        accessibilityLabel={`Showing only ${SUMMARY_FILTER_LABELS[filter]}. Show all notifications`}
      >
        <Text style={[styles.filterText, { color: theme.textSecondary }]}>
          Showing only {SUMMARY_FILTER_LABELS[filter]} ·{' '}
          <Text style={{ color: theme.button, fontWeight: '600' }}>
            Show all
          </Text>
        </Text>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: { margin: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  header: { marginBottom: 10, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  ranges: { flexDirection: 'row', gap: 4 },
  range: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  rangeText: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    // Three per row; a tile alone on the last row keeps the same size.
    width: '31.5%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  tileSelected: { borderWidth: 2 },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileValue: { fontSize: 18, fontWeight: '700' },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  tileDetail: { fontSize: 11, marginTop: 1 },
  empty: { fontSize: 13, paddingVertical: 4 },
  filterBar: { marginHorizontal: 16, marginTop: -4, marginBottom: 8 },
  filterText: { fontSize: 13 },
});
