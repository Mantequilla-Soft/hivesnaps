import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { listMarketItems, buyItem, NotEnrolledError } from '../../../services/pileService';
import type { ItemDTO } from '../../../services/pileService';
import { fetchPointsSummary } from '../../../services/pointsService';
import { onPointsSpent, onPointsEarned } from '../../../utils/pointsEvents';

interface Colors {
  text: string;
  textSecondary: string;
  bubble: string;
  border: string;
  icon: string;
  button: string;
  buttonText: string;
}

interface PileMarketSectionProps {
  currentUsername: string | null;
  colors: Colors;
}

/** "The Pile" market catalog — buy an item here, then throw it from any
 *  snap's PileTray. Lives inside WalletScreen (Phase 3 of the Pile port —
 *  see docs/MOBILE_PARITY_PLAN.md) rather than its own destination, per
 *  that phase's nav decision. Renders nothing when logged out. */
const PileMarketSection: React.FC<PileMarketSectionProps> = ({ currentUsername, colors }) => {
  const [items, setItems] = useState<ItemDTO[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    listMarketItems('hot', 0).then(page => setItems(page.items));
  }, []);

  useEffect(() => {
    if (!currentUsername) {
      setBalance(null);
      return;
    }
    fetchPointsSummary(currentUsername).then(summary => {
      if (summary) setBalance(summary.balance);
    });
  }, [currentUsername]);

  // Keep the visible balance in sync with a spend/earn anywhere else in the
  // app (e.g. a vote award landing while this screen happens to be open).
  useEffect(() => {
    const unsubSpent = onPointsSpent(({ balance: b }) => setBalance(b));
    const unsubEarned = onPointsEarned(({ balance: b }) => setBalance(b));
    return () => {
      unsubSpent();
      unsubEarned();
    };
  }, []);

  const handleBuy = useCallback(
    async (item: ItemDTO) => {
      if (!currentUsername || busyItemId) return;

      setBusyItemId(item.id);
      try {
        const result = await buyItem(item.id, item.price);
        switch (result.status) {
          case 'purchased':
            setBalance(result.balance);
            Alert.alert(
              'Purchased!',
              `${item.name} is now in your inventory — throw it from any snap.`
            );
            break;
          case 'already_purchased':
            Alert.alert(
              'Already Owned',
              'You already have a unit of this queued up in your inventory.'
            );
            break;
          case 'insufficient_balance':
            Alert.alert(
              'Not Enough Points',
              `You need ${item.price.toLocaleString()} points for this — keep snapping, voting, and replying to earn more.`
            );
            break;
          case 'self_purchase':
            Alert.alert(
              "Can't Buy Your Own Item",
              'Creators get a free unit of their own item instead of buying it.'
            );
            break;
          case 'item_not_found':
            Alert.alert('No Longer Available', 'This item may have been removed from the market.');
            setItems(prev => (prev ? prev.filter(i => i.id !== item.id) : prev));
            break;
        }
      } catch (error) {
        if (error instanceof NotEnrolledError) {
          Alert.alert('Not Available Yet', error.message);
        } else {
          Alert.alert(
            'Could Not Complete Purchase',
            error instanceof Error ? error.message : 'Please try again.'
          );
        }
      } finally {
        setBusyItemId(null);
      }
    },
    [currentUsername, busyItemId]
  );

  if (!currentUsername) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>The Pile Market</Text>
        {balance !== null && (
          <Text style={[styles.balance, { color: colors.textSecondary }]}>
            {balance.toLocaleString()} points
          </Text>
        )}
      </View>

      {items === null ? (
        <ActivityIndicator size='small' color={colors.icon} style={styles.loading} />
      ) : items.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No items in the market yet.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.map(item => {
            const isBusy = busyItemId === item.id;
            return (
              <View
                key={item.id}
                style={[styles.card, { backgroundColor: colors.bubble, borderColor: colors.border }]}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  {item.price.toLocaleString()} pts
                </Text>
                <TouchableOpacity
                  style={[styles.buyButton, { backgroundColor: colors.button }]}
                  onPress={() => handleBuy(item)}
                  disabled={isBusy}
                  accessibilityRole='button'
                  accessibilityLabel={`Buy ${item.name} for ${item.price} points`}
                >
                  {isBusy ? (
                    <ActivityIndicator size='small' color={colors.buttonText} />
                  ) : (
                    <Text style={[styles.buyButtonText, { color: colors.buttonText }]}>Buy</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

export default PileMarketSection;

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  balance: {
    fontSize: 13,
    fontWeight: '600',
  },
  loading: {
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.7,
  },
  row: {
    gap: 10,
  },
  card: {
    width: 110,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  itemImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  buyButton: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 60,
  },
  buyButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
