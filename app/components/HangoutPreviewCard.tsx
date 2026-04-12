import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import type { Room } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../../services/HangoutsAuthService';

interface Props {
  roomName: string;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    card: string;
    background: string;
  };
}

export default function HangoutPreviewCard({ roomName, colors }: Props) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    hangoutsAuthService.getClient().getRoom(roomName)
      .then((data) => setRoom(data))
      .catch(() => setRoom(null));
  }, [roomName]);

  if (room === undefined) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <ActivityIndicator size='small' color={colors.textSecondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading hangout...</Text>
      </View>
    );
  }

  if (room === null) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <FontAwesome name='microphone-slash' size={18} color={colors.textSecondary} />
        <Text style={[styles.endedText, { color: colors.textSecondary }]}>This hangout has ended</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={() => router.push('/screens/HangoutsLobbyScreen')}
    >
      <ExpoImage
        source={{ uri: `https://images.hive.blog/u/${room.host}/avatar/sm` }}
        style={styles.avatar}
        contentFit='cover'
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {room.title}
          </Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Text style={[styles.host, { color: colors.textSecondary }]}>
          @{room.host}
        </Text>
      </View>
      <View style={styles.countWrap}>
        <FontAwesome name='headphones' size={14} color={colors.textSecondary} />
        <Text style={[styles.count, { color: colors.text }]}>
          {room.numParticipants ?? 0}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 6,
    gap: 8,
  },
  loadingText: { fontSize: 13, marginLeft: 4 },
  endedText: { fontSize: 13, marginLeft: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '600', flex: 1 },
  liveBadge: { backgroundColor: '#22c55e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  host: { fontSize: 13, marginTop: 2 },
  countWrap: { alignItems: 'center', gap: 4 },
  count: { fontSize: 13, fontWeight: '600' },
});
