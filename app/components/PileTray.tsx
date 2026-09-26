import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { getPile } from '../../services/pileService';
import type { PileEntry } from '../../services/pileService';
import PileThrowersModal from './PileThrowersModal';

interface PileTrayProps {
  author: string;
  permlink: string;
  colors: {
    background: string;
    text: string;
    bubble: string;
    border: string;
    button: string;
    buttonText: string;
  };
}

/** "The Pile" — everything thrown at one Snap, as pill badges (item image +
 *  count). Read-only for now (Phase 1 of the Pile port — see
 *  docs/MOBILE_PARITY_PLAN.md): no throw affordance yet, so a Snap with
 *  nothing thrown at it renders nothing at all rather than an empty tray. */
const PileTray: React.FC<PileTrayProps> = ({ author, permlink, colors }) => {
  const [pile, setPile] = useState<PileEntry[]>([]);
  const [selected, setSelected] = useState<PileEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPile(author, permlink).then(result => {
      if (!cancelled) setPile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [author, permlink]);

  if (pile.length === 0) return null;

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

      <PileThrowersModal
        visible={selected !== null}
        entry={selected}
        onClose={() => setSelected(null)}
        colors={colors}
      />
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
  count: {
    fontSize: 12,
    fontWeight: '600',
  },
});
