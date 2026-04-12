import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import type { Room } from '@snapie/hangouts-core';
import { getTheme } from '../../constants/Colors';
import { useHangoutsAuth } from '../../hooks/useHangoutsAuth';
import { useHangoutsRoomList } from '../../hooks/useHangoutsRoomList';
import { useHangoutsRoom } from '../../hooks/useHangoutsRoom';

export default function HangoutsLobbyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const theme = getTheme(isDark ? 'dark' : 'light');
  const router = useRouter();

  const { isAuthenticated, isLoading: authLoading, authenticate } = useHangoutsAuth();
  const { rooms, isLoading: roomsLoading, error: roomsError, refresh } = useHangoutsRoomList();
  const { create, isLoading: createLoading, error: createError } = useHangoutsRoom();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      authenticate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-once auth check
  }, []);

  const closeCreateModal = () => {
    setCreateModalVisible(false);
    setRoomTitle('');
    setRoomDescription('');
  };

  const handleCreateRoom = async () => {
    const trimmed = roomTitle.trim();
    if (!trimmed) return;
    try {
      await create(trimmed, roomDescription.trim() || undefined);
      closeCreateModal();
      refresh();
      Alert.alert('Room Created', 'Your hangout is live! Audio joining coming soon.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create room');
    }
  };

  const handleRoomPress = (_room: Room) => {
    Alert.alert('Coming Soon', 'Audio joining is coming in Phase 2!');
  };

  const renderRoomCard = ({ item }: { item: Room }) => (
    <Pressable
      style={[styles.roomCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => handleRoomPress(item)}
      accessibilityRole='button'
      accessibilityLabel={`${item.title} by @${item.host}`}
      accessibilityHint={`${item.numParticipants ?? 0} listening. Tap to join`}
    >
      <ExpoImage
        source={{ uri: `https://images.hive.blog/u/${item.host}/avatar/sm` }}
        style={styles.hostAvatar}
        contentFit='cover'
      />
      <View style={styles.roomInfo}>
        <View style={styles.titleRow}>
          <Text style={[styles.roomTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.liveBadge, { backgroundColor: theme.success }]}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Text style={[styles.hostName, { color: theme.textSecondary }]}>
          @{item.host}
        </Text>
      </View>
      <View style={styles.participantWrap}>
        <FontAwesome name='headphones' size={14} color={theme.textSecondary} />
        <Text style={[styles.participantCount, { color: theme.text }]}>
          {item.numParticipants ?? 0}
        </Text>
      </View>
    </Pressable>
  );

  const renderEmpty = () => {
    if (roomsLoading || authLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name='microphone-slash' size={48} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No active hangouts right now
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
          Be the first to start one!
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole='button'
          accessibilityLabel='Go back'
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <FontAwesome name='arrow-left' size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Hangouts</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: theme.button }]}
          accessibilityRole='button'
          accessibilityLabel='Start a new hangout'
          accessibilityHint='Opens room creation form'
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => {
            if (authLoading) return;
            if (!isAuthenticated) {
              authenticate().then((ok) => {
                if (ok) setCreateModalVisible(true);
                else Alert.alert('Sign in required', 'Could not authenticate with Hangouts server.');
              });
            } else {
              setCreateModalVisible(true);
            }
          }}
          disabled={createLoading || authLoading}
        >
          <FontAwesome name='plus' size={14} color={theme.buttonText} />
        </TouchableOpacity>
      </View>

      {/* Auth banner */}
      {!isAuthenticated && !authLoading && (
        <View style={[styles.authBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.authBannerText, { color: theme.textSecondary }]}>
            Sign in to create or join rooms
          </Text>
          <TouchableOpacity onPress={() => {
            authenticate().then((ok) => {
              if (!ok) Alert.alert('Sign in required', 'Could not authenticate with Hangouts server.');
            });
          }}>
            <Text style={[styles.authBannerLink, { color: theme.button }]}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Room list */}
      {(roomsLoading || authLoading) && rooms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={theme.button} />
        </View>
      ) : roomsError && rooms.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{roomsError}</Text>
          <TouchableOpacity onPress={refresh} style={[styles.retryBtn, { borderColor: theme.border }]}>
            <Text style={{ color: theme.button }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {roomsError && (
            <View style={[styles.inlineError, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.inlineErrorText, { color: theme.textSecondary }]}>{roomsError}</Text>
              <TouchableOpacity onPress={refresh}>
                <Text style={[styles.inlineErrorRetry, { color: theme.button }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.name}
            renderItem={renderRoomCard}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            onRefresh={refresh}
            refreshing={roomsLoading}
          />
        </>
      )}

      {/* Create Room Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType='slide'
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView
              keyboardShouldPersistTaps='handled'
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Start a Hangout</Text>

              <TextInput
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                placeholder='Room title'
                placeholderTextColor={theme.textSecondary}
                value={roomTitle}
                onChangeText={setRoomTitle}
                maxLength={80}
                returnKeyType='next'
              />

              <TextInput
                style={[styles.modalInput, styles.modalInputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                placeholder='Description (optional)'
                placeholderTextColor={theme.textSecondary}
                value={roomDescription}
                onChangeText={setRoomDescription}
                maxLength={200}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: theme.border }]}
                  accessibilityRole='button'
                  accessibilityLabel='Cancel'
                  onPress={closeCreateModal}
                >
                  <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCreate, { backgroundColor: theme.button, opacity: roomTitle.trim() ? 1 : 0.5 }]}
                  accessibilityRole='button'
                  accessibilityLabel='Go Live'
                  accessibilityHint='Creates the room and starts your hangout'
                  onPress={handleCreateRoom}
                  disabled={!roomTitle.trim() || createLoading}
                >
                  {createLoading ? (
                    <ActivityIndicator size='small' color={theme.buttonText} />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: theme.buttonText }]}>Go Live</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

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
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  authBannerText: { fontSize: 13 },
  authBannerLink: { fontSize: 13, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineErrorText: { fontSize: 13, flex: 1 },
  inlineErrorRetry: { fontSize: 13, fontWeight: '600', marginLeft: 12 },
  listContent: { padding: 16, flexGrow: 1 },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  hostAvatar: { width: 48, height: 48, borderRadius: 24 },
  roomInfo: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  liveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  hostName: { fontSize: 13, marginTop: 3 },
  participantWrap: { alignItems: 'center', marginLeft: 12, gap: 4 },
  participantCount: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 13, marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnCreate: {},
  modalBtnText: { fontSize: 16, fontWeight: '600' },
});
