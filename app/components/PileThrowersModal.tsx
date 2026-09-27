import React from 'react';
import { Modal, View, Text, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getAvatarImageUrl } from '../../services/AvatarService';
import { formatNotificationTime } from '../../utils/notifications';
import type { PileEntry, PileThrower } from '../../services/pileService';

interface PileThrowersModalProps {
  visible: boolean;
  entry: PileEntry | null;
  onClose: () => void;
  colors: {
    background: string;
    text: string;
    border: string;
    button: string;
    buttonText: string;
  };
}

/** "Who threw what" for one item on the Pile — same centered-card modal
 *  shape as StaticContentModal/UpvoteModal, fed from an already-fetched
 *  PileEntry instead of its own network call. */
const PileThrowersModal: React.FC<PileThrowersModalProps> = ({
  visible,
  entry,
  onClose,
  colors,
}) => {
  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          {entry && (
            <>
              <View style={styles.header}>
                <Image source={{ uri: entry.item.imageUrl }} style={styles.itemImage} />
                <Text style={[styles.title, { color: colors.text }]}>
                  {entry.item.name} ({entry.count})
                </Text>
              </View>

              <FlatList
                data={entry.recentThrowers}
                keyExtractor={(t: PileThrower, i) => `${t.username}-${t.createdAt}-${i}`}
                style={styles.list}
                renderItem={({ item }) => (
                  <View style={styles.throwerRow}>
                    {item.anonymous ? (
                      <View style={[styles.avatar, styles.anonAvatar, { borderColor: colors.border }]}>
                        <FontAwesome name='user-secret' size={16} color={colors.text} />
                      </View>
                    ) : (
                      <Image source={{ uri: getAvatarImageUrl(item.username) }} style={styles.avatar} />
                    )}
                    <Text style={[styles.throwerName, { color: colors.text }]} numberOfLines={1}>
                      {item.anonymous ? 'Anonymous' : `@${item.username}`}
                    </Text>
                    <Text style={[styles.throwerTime, { color: colors.text }]}>
                      {formatNotificationTime(item.createdAt)}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    Nobody&apos;s thrown one yet
                  </Text>
                }
              />
            </>
          )}

          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.button }]}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close'
          >
            <Text style={[styles.closeButtonText, { color: colors.buttonText }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default PileThrowersModal;

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
    maxWidth: 400,
    maxHeight: '75%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  itemImage: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  list: {
    maxHeight: 320,
  },
  throwerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  anonAvatar: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  throwerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  throwerTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    opacity: 0.6,
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
