import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import {
  getMyInventory,
  throwItem,
  NotEnrolledError,
} from '../../services/pileService';
import type { InventoryEntry, ItemDTO, ItemThrowTargetType } from '../../services/pileService';

interface ThrowItemModalProps {
  visible: boolean;
  onClose: () => void;
  author: string;
  permlink: string;
  targetType: ItemThrowTargetType;
  /** Called only after a real 'thrown' result — lets the caller (PileTray)
   *  patch its already-fetched pile locally instead of refetching, same
   *  idea as snapie.io's ITEM_THROWN_EVENT. */
  onThrown: (item: ItemDTO, anonymous: boolean) => void;
  colors: {
    background: string;
    text: string;
    border: string;
    button: string;
    buttonText: string;
    icon: string;
  };
}

/** Inventory picker over the caller's owned (unthrown) units — RN
 *  equivalent of snapie.io's ThrowItemButton.tsx picker, same centered-card
 *  modal shape as UpvoteModal/StaticContentModal/PileThrowersModal rather
 *  than a new sheet primitive. */
const ThrowItemModal: React.FC<ThrowItemModalProps> = ({
  visible,
  onClose,
  author,
  permlink,
  targetType,
  onThrown,
  colors,
}) => {
  const [inventory, setInventory] = useState<InventoryEntry[] | null>(null);
  const [busy, setBusy] = useState<{ itemId: string; anonymous: boolean } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setInventory(null);
    getMyInventory().then(setInventory);
  }, [visible]);

  async function handleThrow(entry: InventoryEntry, anonymous: boolean) {
    const unitId = entry.unitIds[0];
    if (!unitId || busy) return;

    setBusy({ itemId: entry.item.id, anonymous });
    try {
      const result = await throwItem(
        unitId,
        { author, permlink, type: targetType },
        entry.item,
        anonymous
      );

      if (result.status === 'thrown') {
        onThrown(entry.item, anonymous);
        setInventory(prev =>
          prev
            ? prev
                .map(e =>
                  e.item.id === entry.item.id ? { ...e, unitIds: e.unitIds.slice(1) } : e
                )
                .filter(e => e.unitIds.length > 0)
            : prev
        );
        // Close so the pile underneath — already patched via onThrown — is
        // immediately visible instead of sitting behind this modal.
        onClose();
      } else if (result.status === 'insufficient_balance') {
        Alert.alert(
          'Not Enough Points',
          `Throwing anonymously also burns ${entry.item.price.toLocaleString()} points on top of the item itself — you don't have enough for that right now.`
        );
      } else {
        Alert.alert(
          'Could Not Throw That',
          "That item may have already been thrown, or isn't yours anymore."
        );
      }
    } catch (error) {
      if (error instanceof NotEnrolledError) {
        Alert.alert('Not Available Yet', error.message);
      } else {
        Alert.alert(
          'Could Not Throw That',
          error instanceof Error ? error.message : 'Please try again.'
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Throw something</Text>

          {inventory === null ? (
            <ActivityIndicator size='small' color={colors.icon} style={styles.loading} />
          ) : inventory.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.text }]}>
              You don&apos;t have anything to throw yet — buy an item from the market to
              get started.
            </Text>
          ) : (
            <FlatList
              data={inventory}
              keyExtractor={e => e.item.id}
              style={styles.list}
              renderItem={({ item: entry }) => {
                const isBusy = busy?.itemId === entry.item.id;
                return (
                  <View style={[styles.row, { borderColor: colors.border }]}>
                    <Image source={{ uri: entry.item.imageUrl }} style={styles.itemImage} />
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                        {entry.item.name}
                      </Text>
                      <Text style={[styles.itemCount, { color: colors.text }]}>
                        ×{entry.unitIds.length}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.throwButton, { backgroundColor: colors.button }]}
                      onPress={() => handleThrow(entry, false)}
                      disabled={!!busy}
                      accessibilityRole='button'
                      accessibilityLabel={`Throw ${entry.item.name}`}
                    >
                      {isBusy && busy?.anonymous === false ? (
                        <ActivityIndicator size='small' color={colors.buttonText} />
                      ) : (
                        <Text style={[styles.throwButtonText, { color: colors.buttonText }]}>
                          Throw
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.anonButton, { borderColor: colors.border }]}
                      onPress={() => handleThrow(entry, true)}
                      disabled={!!busy}
                      accessibilityRole='button'
                      accessibilityLabel={`Throw ${entry.item.name} anonymously — also burns ${entry.item.price} points`}
                    >
                      {isBusy && busy?.anonymous === true ? (
                        <ActivityIndicator size='small' color={colors.text} />
                      ) : (
                        <FontAwesome name='user-secret' size={14} color={colors.text} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.button }]}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close'
          >
            <Text style={[styles.closeButtonText, { color: colors.buttonText }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ThrowItemModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  loading: {
    marginVertical: 24,
  },
  emptyText: {
    opacity: 0.7,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  itemImage: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  throwButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 64,
    alignItems: 'center',
  },
  throwButtonText: {
    fontWeight: '600',
    fontSize: 13,
  },
  anonButton: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
