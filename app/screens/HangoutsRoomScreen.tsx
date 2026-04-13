import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import {
  LiveKitRoom,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  AudioSession,
} from '@livekit/react-native';
import type { ConnectionState, Participant } from 'livekit-client';
import { FontAwesome } from '@expo/vector-icons';
import { getTheme } from '../../constants/Colors';
import { LIVEKIT_URL } from '../config/env';
import { hangoutsAuthService } from '../../services/HangoutsAuthService';
import { useHangoutsRoom } from '../../hooks/useHangoutsRoom';
import IconButton from '../components/IconButton';
import SpeakerStage from '../components/hangouts/SpeakerStage';
import AudienceSection from '../components/hangouts/AudienceSection';
import RoomControls from '../components/hangouts/RoomControls';
import ChatPanel from '../components/hangouts/ChatPanel';
import HostControlsPanel from '../components/hangouts/HostControlsPanel';

// ─── Inner screen rendered inside <LiveKitRoom> provider ───────────────────

function RoomScreenInner({
  roomName,
  roomTitle,
  roomHost,
  isHost,
  onLeave,
}: {
  roomName: string;
  roomTitle: string;
  roomHost: string;
  isHost: boolean;
  onLeave: () => void;
}): React.ReactElement {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const client = hangoutsAuthService.getClient();

  const [activeSpeakerIdentities, setActiveSpeakerIdentities] = useState<string[]>([]);
  const [raisedHandIdentities, setRaisedHandIdentities] = useState<string[]>([]);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  // Track active speakers
  useEffect(() => {
    const onSpeakersChanged = (speakers: Participant[]) => {
      setActiveSpeakerIdentities(speakers.map((s) => s.identity));
    };
    room.on('activeSpeakersChanged', onSpeakersChanged);
    return () => { room.off('activeSpeakersChanged', onSpeakersChanged); };
  }, [room]);

  // Receive hand-raise data messages
  useDataChannel('hand-raise', useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as {
        type: string;
        raised: boolean;
        identity: string;
      };
      if (data.type === 'hand_raise') {
        setRaisedHandIdentities((prev) =>
          data.raised ? [...new Set([...prev, data.identity])] : prev.filter((id) => id !== data.identity)
        );
      }
    } catch {
      // malformed — ignore
    }
  }, []));

  const handleToggleMute = useCallback(async (): Promise<void> => {
    if (!localParticipant) return;
    await localParticipant.setMicrophoneEnabled(localParticipant.isMicrophoneEnabled ? false : true);
  }, [localParticipant]);

  const handleToggleHand = useCallback(async (): Promise<void> => {
    if (!localParticipant) return;
    const raised = !hasRaisedHand;
    const payload = {
      type: 'hand_raise',
      raised,
      identity: localParticipant.identity,
      timestamp: Date.now(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    await localParticipant.publishData(bytes, { reliable: true });
    setHasRaisedHand(raised);
  }, [hasRaisedHand, localParticipant]);

  const handleApprove = useCallback(async (identity: string): Promise<void> => {
    try {
      await client.setPermissions(roomName, identity, true);
      setRaisedHandIdentities((prev) => prev.filter((id) => id !== identity));
    } catch {
      Alert.alert('Error', 'Could not promote participant.');
    }
  }, [client, roomName]);

  const handleDeny = useCallback((identity: string): void => {
    setRaisedHandIdentities((prev) => prev.filter((id) => id !== identity));
  }, []);

  const handleMuteParticipant = useCallback(async (identity: string): Promise<void> => {
    try {
      await client.setPermissions(roomName, identity, false);
    } catch {
      Alert.alert('Error', 'Could not mute participant.');
    }
  }, [client, roomName]);

  const handleKick = useCallback(async (identity: string): Promise<void> => {
    Alert.alert('Remove participant', `Remove @${identity} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await client.kickParticipant(roomName, identity);
          } catch {
            Alert.alert('Error', 'Could not remove participant.');
          }
        },
      },
    ]);
  }, [client, roomName]);

  const handleEndRoom = useCallback((): void => {
    Alert.alert('End Room', 'This will end the hangout for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Room', style: 'destructive',
        onPress: async () => {
          try {
            await client.deleteRoom(roomName);
          } catch {
            // best-effort — leave regardless
          }
          onLeave();
        },
      },
    ]);
  }, [client, roomName, onLeave]);

  const colors = {
    text: theme.text,
    textSecondary: theme.textSecondary,
    card: theme.card,
    border: theme.border,
    success: theme.success,
    button: theme.button,
    buttonText: theme.buttonText,
    icon: theme.icon,
    error: theme.error ?? '#EF4444',
    background: theme.background,
  };

  return (
    <View style={styles.inner}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <IconButton
          name='arrow-left'
          size={20}
          color={theme.text}
          onPress={onLeave}
          accessibilityLabel='Leave room'
          style={styles.backBtn}
        />
        <View style={styles.headerCenter}>
          <ExpoImage
            source={{ uri: `https://images.hive.blog/u/${roomHost}/avatar/sm` }}
            style={styles.headerAvatar}
            contentFit='cover'
          />
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {roomTitle}
            </Text>
            <Text style={[styles.headerHost, { color: theme.textSecondary }]}>@{roomHost}</Text>
          </View>
          <View style={[styles.liveBadge, { backgroundColor: theme.success }]}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Speaker stage */}
      <SpeakerStage
        activeSpeakerIdentities={activeSpeakerIdentities}
        raisedHandIdentities={raisedHandIdentities}
        colors={colors}
      />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Audience */}
      <AudienceSection
        isHost={isHost}
        raisedHandIdentities={raisedHandIdentities}
        activeSpeakerIdentities={activeSpeakerIdentities}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onLongPress={(identity) => setSelectedParticipant(identity)}
        colors={colors}
      />

      {/* Chat panel */}
      <ChatPanel
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        colors={colors}
      />

      {/* Controls */}
      <RoomControls
        isHost={isHost}
        hasRaisedHand={hasRaisedHand}
        onToggleMute={handleToggleMute}
        onToggleHand={handleToggleHand}
        onToggleChat={() => setChatVisible((v) => !v)}
        onLeave={onLeave}
        onEndRoom={handleEndRoom}
        colors={colors}
      />

      {/* Host action sheet */}
      {isHost && (
        <HostControlsPanel
          identity={selectedParticipant}
          onPromote={handleApprove}
          onMute={handleMuteParticipant}
          onKick={handleKick}
          onClose={() => setSelectedParticipant(null)}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── Outer screen — sets up LiveKitRoom provider ───────────────────────────

export default function HangoutsRoomScreen(): React.ReactElement {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const router = useRouter();
  const { roomName, livekitToken } = useLocalSearchParams<{
    roomName: string;
    livekitToken: string;
  }>();
  const { roomMeta, isHost, leave: clearRoomState } = useHangoutsRoom();

  const [connectionState, setConnectionState] = useState<ConnectionState | 'idle'>('idle');
  // On Android we must resolve mic permission before LiveKitRoom mounts,
  // otherwise LiveKit tries to open the mic while the dialog is still pending.
  const [permissionReady, setPermissionReady] = useState(Platform.OS !== 'android');

  // Request Android mic permission — gate LiveKitRoom until resolved
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).then((result) => {
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Microphone required',
          'Please grant microphone access to join audio rooms.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        setPermissionReady(true);
      }
    });
  }, [router]);

  // Configure audio session
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => { void AudioSession.stopAudioSession(); };
  }, []);

  const handleLeave = useCallback((): void => {
    clearRoomState();
    router.back();
  }, [clearRoomState, router]);

  if (!livekitToken || !roomName) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Invalid room parameters.</Text>
      </SafeAreaView>
    );
  }

  const displayTitle = roomMeta?.title ?? roomName;
  const displayHost = roomMeta?.host ?? '';

  if (!permissionReady) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size='large' color={theme.button} />
        <Text style={[styles.connectingText, { color: theme.textSecondary }]}>
          Requesting microphone access...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={livekitToken}
        connect={true}
        audio={true}
        video={false}
        onConnected={() => setConnectionState('connected' as ConnectionState)}
        onDisconnected={() => {
          setConnectionState('disconnected' as ConnectionState);
          handleLeave();
        }}
        onError={(err) => {
          setConnectionState('disconnected' as ConnectionState);
          Alert.alert('Connection error', err.message, [{ text: 'Leave', onPress: handleLeave }]);
        }}
      >
        {connectionState !== 'connected' ? (
          <View style={styles.center}>
            <ActivityIndicator size='large' color={theme.button} />
            <Text style={[styles.connectingText, { color: theme.textSecondary }]}>
              Connecting to room...
            </Text>
          </View>
        ) : (
          <RoomScreenInner
            roomName={roomName}
            roomTitle={displayTitle}
            roomHost={displayHost}
            isHost={isHost}
            onLeave={handleLeave}
          />
        )}
      </LiveKitRoom>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  connectingText: { marginTop: 12, fontSize: 14 },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { fontSize: 15, fontWeight: '600', maxWidth: 160 },
  headerHost: { fontSize: 12 },
  liveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  divider: { height: 1, marginHorizontal: 16 },
});
