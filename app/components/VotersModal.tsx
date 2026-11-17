import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getClient } from '../../services/HiveClient';
import { getAvatarImageUrl } from '../../services/AvatarService';
import { buildVoterRows, fetchAllVotes, type VoterRow } from '../../utils/voters';
import { useAppColors } from '../styles/colors';

interface VotersModalProps {
  visible: boolean;
  author: string;
  permlink: string;
  onClose: () => void;
}

/**
 * Who voted on a snap/post — opened by tapping the vote count. Fetches fresh
 * votes when opened (get_content, plus list_votes paging past its 1,000-vote
 * cap) and sorts them by $ contribution. FlatList keeps long lists cheap.
 */
const VotersModal: React.FC<VotersModalProps> = ({ visible, author, permlink, onClose }) => {
  const colors = useAppColors();
  const router = useRouter();
  const [rows, setRows] = useState<VoterRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const client = getClient();
      const { post, votes } = await fetchAllVotes(
        (api, method, params) => client.call(api, method, params),
        author,
        permlink
      );
      setRows(buildVoterRows(votes, post));
    } catch (err) {
      console.warn('[VotersModal] Failed to load voters:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [author, permlink]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const openProfile = (username: string) => {
    onClose();
    router.push({ pathname: '/screens/ProfileScreen', params: { username } });
  };

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel='Close voters list' />
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Votes{rows && !loading ? ` (${rows.length})` : ''}
          </Text>

          {loading ? (
            <ActivityIndicator style={styles.status} color={colors.button} />
          ) : error ? (
            <View style={styles.status}>
              <Text style={[styles.emptyText, { color: colors.text }]}>Couldn&apos;t load votes</Text>
              <Pressable onPress={load} accessibilityRole='button' accessibilityLabel='Retry loading votes'>
                <Text style={[styles.retry, { color: colors.button }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={rows || []}
              keyExtractor={(r) => r.voter}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => openProfile(item.voter)}
                  accessibilityRole='button'
                  accessibilityLabel={`Open @${item.voter}'s profile`}
                >
                  <Image source={{ uri: getAvatarImageUrl(item.voter) }} style={styles.avatar} />
                  <View style={styles.nameCol}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                      @{item.voter}
                    </Text>
                    {item.reputation !== null && (
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        Reputation {item.reputation}
                      </Text>
                    )}
                  </View>
                  <View style={styles.valueCol}>
                    <Text
                      style={[styles.value, { color: item.isDownvote ? colors.error : colors.payout }]}
                    >
                      {item.isDownvote ? '-' : '+'}${Math.abs(item.value).toFixed(3)}
                    </Text>
                    {item.percent !== null && (
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        {Math.round(item.percent)}%
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.text }]}>No votes yet</Text>
              }
            />
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

export default VotersModal;

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
    maxHeight: '80%',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  status: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
  valueCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    opacity: 0.6,
  },
  retry: {
    fontWeight: '600',
    fontSize: 15,
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
