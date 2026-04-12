import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import type { Room } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../../services/HangoutsAuthService';

type FetchState =
  | { status: 'loading' }
  | { status: 'found'; room: Room }
  | { status: 'not_found' }
  | { status: 'error' };

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
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    let stale = false;
    setState({ status: 'loading' });

    hangoutsAuthService.getClient().getRoom(roomName)
      .then((data) => {
        if (stale) return;
        setState(data ? { status: 'found', room: data } : { status: 'not_found' });
      })
      .catch(() => {
        if (stale) return;
        setState({ status: 'error' });
      });

    return () => { stale = true; };
  }, [roomName]);

  if (state.status === 'loading') {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <ActivityIndicator size='small' color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>Loading hangout...</Text>
      </View>
    );
  }

  if (state.status === 'not_found') {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <FontAwesome name='microphone-slash' size={18} color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>This hangout has ended</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <FontAwesome name='exclamation-circle' size={18} color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>Could not load hangout</Text>
      </View>
    );
  }

  const { room } = state;

  return (
    <Pressable
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={() => router.push('/screens/HangoutsLobbyScreen')}
      accessibilityRole='button'
      accessibilityLabel={`Hangout: ${room.title}, hosted by ${room.host}`}
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
  statusText: { fontSize: 13, marginLeft: 6 },
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
