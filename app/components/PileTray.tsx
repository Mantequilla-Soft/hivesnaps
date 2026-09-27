import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getPile } from '../../services/pileService';
import type { ItemDTO, ItemThrowTargetType, PileEntry } from '../../services/pileService';
import PileThrowersModal from './PileThrowersModal';
import ThrowItemModal from './ThrowItemModal';

// Mirrors snapie.io's MAX_THROWERS_PER_ITEM (lib/points/marketConfig.ts) —
// caps this optimistic local patch at the same size a fresh getPile() fetch
// would ever return, so a very active pile can't grow past that client-side.
const MAX_THROWERS_PER_ITEM = 50;

interface PileTrayProps {
  author: string;
  permlink: string;
  targetType?: ItemThrowTargetType;
  /** Whoever's viewing this — omit/null to hide the throw affordance
   *  entirely (e.g. logged-out viewers), same gating Snap.tsx already uses
   *  for edit/reply. */
  currentUsername?: string | null;
  colors: {
    background: string;
    text: string;
    bubble: string;
    border: string;
    button: string;
    buttonText: string;
    icon: string;
  };
}

/** "The Pile" — everything thrown at one Snap, as pill badges (item image +
 *  count), plus (when logged in) a "Throw" affordance opening the inventory
 *  picker. Renders nothing at all when there's neither a pile to show nor a
 *  way to add to one. */
const PileTray: React.FC<PileTrayProps> = ({
  author,
  permlink,
  targetType = 'snap',
  currentUsername,
  colors,
}) => {
  const [pile, setPile] = useState<PileEntry[]>([]);
  const [selected, setSelected] = useState<PileEntry | null>(null);
  const [throwModalVisible, setThrowModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPile(author, permlink).then(result => {
      if (!cancelled) setPile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [author, permlink]);

  function handleThrown(item: ItemDTO, anonymous: boolean) {
    const thrower = {
      username: anonymous ? 'Anonymous' : currentUsername || 'Anonymous',
      createdAt: new Date().toISOString(),
      anonymous,
    };

    setPile(prev => {
      const existing = prev.find(entry => entry.item.id === item.id);
      const next = existing
        ? prev.map(entry =>
            entry.item.id === item.id
              ? {
                  ...entry,
                  count: entry.count + 1,
                  recentThrowers: [thrower, ...entry.recentThrowers].slice(0, MAX_THROWERS_PER_ITEM),
                }
              : entry
          )
        : [{ item, count: 1, recentThrowers: [thrower] }, ...prev];

      return next.sort((a, b) => b.count - a.count);
    });
  }

  if (pile.length === 0 && !currentUsername) return null;

  return (
    <View style={styles.container}>
      {pile.map(entry => (
        <TouchableOpacity
          key={entry.item.id}
          style={[styles.pill, { backgroundColor: colors.bubble, borderColor: colors.border }]}
          onPress={() => setSelected(entry)}
          accessibilityRole='button'
          accessibilityLabel={`${entry.item.name}, thrown ${entry.count} time${entry.count === 1 ? '' : 's'}`}
        >
          <Image source={{ uri: entry.item.imageUrl }} style={styles.itemImage} />
          <Text style={[styles.count, { color: colors.text }]}>{entry.count}</Text>
        </TouchableOpacity>
      ))}

      {currentUsername && (
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: colors.bubble, borderColor: colors.border }]}
          onPress={() => setThrowModalVisible(true)}
          accessibilityRole='button'
          accessibilityLabel='Throw something at this snap'
        >
          <FontAwesome name='dot-circle-o' size={14} color={colors.icon} style={styles.throwIcon} />
          <Text style={[styles.count, { color: colors.text }]}>Throw</Text>
        </TouchableOpacity>
      )}

      <PileThrowersModal
        visible={selected !== null}
        entry={selected}
        onClose={() => setSelected(null)}
        colors={colors}
      />

      {currentUsername && (
        <ThrowItemModal
          visible={throwModalVisible}
          onClose={() => setThrowModalVisible(false)}
          author={author}
          permlink={permlink}
          targetType={targetType}
          onThrown={handleThrown}
          colors={colors}
        />
      )}
    </View>
  );
};

export default PileTray;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  itemImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    marginRight: 4,
  },
  throwIcon: {
    marginRight: 4,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
  },
});
