import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
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
import { DisconnectReason } from '@livekit/protocol';
import { getTheme } from '../../constants/Colors';
import { LIVEKIT_URL } from '../config/env';
import { hangoutsAuthService } from '../../services/HangoutsAuthService';
import { useHangoutsRecording } from '../../hooks/useHangoutsRecording';
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
  roomDescription,
  isHost,
  onLeave,
}: {
  roomName: string;
  roomTitle: string;
  roomHost: string;
  roomDescription: string;
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
  const [chatMessages, setChatMessages] = useState<{ id: string; identity: string; text: string; timestamp: number }[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatVisibleRef = useRef(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  // Keep ref in sync so the stable data-channel callback can read current chat visibility
  useEffect(() => {
    chatVisibleRef.current = chatVisible;
  }, [chatVisible]);

  // Track active speakers
  useEffect(() => {
    const onSpeakersChanged = (speakers: Participant[]) => {
      setActiveSpeakerIdentities(speakers.map((s) => s.identity));
    };
    room.on('activeSpeakersChanged', onSpeakersChanged);
    return () => { room.off('activeSpeakersChanged', onSpeakersChanged); };
  }, [room]);

  // Receive hand-raise data messages (always mounted — topic must match sender)
  const { send: sendHandRaise } = useDataChannel('hand-raise', useCallback((msg: { payload: Uint8Array }) => {
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

  // Recording — host only
  const { isRecording, isUploading, startRecording, stopAndPost } = useHangoutsRecording(
    roomName, roomTitle, roomDescription,
  );

  // Non-host participants mirror the host's recording state via data channel
  const [broadcastRecording, setBroadcastRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number>(0);
  const visibleRecordingState = isHost ? isRecording : broadcastRecording;

  // Broadcast recording state so all participants see the REC indicator
  const { send: sendRecordingState } = useDataChannel('recording-state', useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as { type: string; recording: boolean; startedAt?: number };
      if (data.type === 'recording_state') {
        setBroadcastRecording(data.recording);
        if (data.recording && data.startedAt) {
          setRecordingStartedAt(data.startedAt);
        }
      }
    } catch {
      // malformed — ignore
    }
  }, []));

  // Keep a ref so the participantConnected handler always reads the latest value
  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Guard against double-tapping the record toggle while an async transition is in flight
  const isTogglingRef = useRef(false);

  // Keep a stable ref to recordingStartedAt so the participantConnected handler reads the latest value
  const recordingStartedAtRef = useRef(recordingStartedAt);
  useEffect(() => {
    recordingStartedAtRef.current = recordingStartedAt;
  }, [recordingStartedAt]);

  // Host re-broadcasts current recording state to late-joining participants
  useEffect(() => {
    if (!isHost) return;
    const onParticipantConnected = () => {
      if (!isRecordingRef.current) return;
      sendRecordingState(
        new TextEncoder().encode(JSON.stringify({ type: 'recording_state', recording: true, startedAt: recordingStartedAtRef.current })),
        { reliable: true },
      ).catch(() => {});
    };
    room.on('participantConnected', onParticipantConnected);
    return () => { room.off('participantConnected', onParticipantConnected); };
  }, [isHost, room, sendRecordingState]);

  const handleToggleRecording = useCallback(async (): Promise<void> => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    try {
      if (isRecording) {
        try {
          await stopAndPost();
          sendRecordingState(
            new TextEncoder().encode(JSON.stringify({ type: 'recording_state', recording: false })),
            { reliable: true },
          ).catch(() => {});
          Alert.alert('Recording posted', 'The recording has been uploaded and posted as a snap.');
        } catch (err) {
          Alert.alert('Recording failed', err instanceof Error ? err.message : 'Could not stop recording');
        }
      } else {
        try {
          await startRecording();
          const startedAt = Date.now();
          setRecordingStartedAt(startedAt);
          sendRecordingState(
            new TextEncoder().encode(JSON.stringify({ type: 'recording_state', recording: true, startedAt })),
            { reliable: true },
          ).catch(() => {});
        } catch (err) {
          Alert.alert('Recording failed', err instanceof Error ? err.message : 'Could not start recording');
        }
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [isRecording, startRecording, stopAndPost, sendRecordingState]);

  // Receive and send chat messages at room level so they're captured even when ChatPanel is closed
  const { send: sendChatData } = useDataChannel('chat', useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as {
        type: string;
        identity: string;
        text: string;
        timestamp: number;
      };
      if (data.type === 'chat') {
        setChatMessages((prev) => [...prev, { id: `${data.identity}-${data.timestamp}`, ...data }]);
        if (!chatVisibleRef.current) {
          setUnreadChatCount((n) => n + 1);
        }
      }
    } catch {
      // malformed — ignore
    }
  }, []));

  const handleSendChat = useCallback((text: string): void => {
    if (!localParticipant || !text.trim()) return;
    const event = {
      type: 'chat',
      identity: localParticipant.identity,
      text: text.trim(),
      timestamp: Date.now(),
    };
    sendChatData(new TextEncoder().encode(JSON.stringify(event)), { reliable: true }).catch(() => {});
    setChatMessages((prev) => [...prev, { id: `local-${event.timestamp}`, ...event }]);
  }, [localParticipant, sendChatData]);

  const handleToggleMute = useCallback((): void => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled).catch(() => {});
  }, [localParticipant]);

  // Use useDataChannel send so the topic header is attached — publishData sends without topic
  const handleToggleHand = useCallback((): void => {
    if (!localParticipant) return;
    const raised = !hasRaisedHand;
    const bytes = new TextEncoder().encode(JSON.stringify({
      type: 'hand_raise',
      raised,
      identity: localParticipant.identity,
      timestamp: Date.now(),
    }));
    sendHandRaise(bytes, { reliable: true }).catch(() => {});
    setHasRaisedHand(raised);
  }, [hasRaisedHand, localParticipant, sendHandRaise]);

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
    // Broadcast hand-lower so the requester's local raised-hand state resets
    const bytes = new TextEncoder().encode(JSON.stringify({
      type: 'hand_raise',
      raised: false,
      identity,
      timestamp: Date.now(),
    }));
    sendHandRaise(bytes, { reliable: true }).catch(() => {});
  }, [sendHandRaise]);

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

  // Best-effort stop: if host leaves or ends the room while recording, stop first
  const handleLeaveWithCleanup = useCallback((): void => {
    if (isHost && isRecordingRef.current) {
      void stopAndPost().catch(() => {});
    }
    onLeave();
  }, [isHost, stopAndPost, onLeave]);

  const handleEndRoom = useCallback((): void => {
    Alert.alert('End Room', 'This will end the hangout for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Room', style: 'destructive',
        onPress: () => {
          // Stop any active recording best-effort before tearing down the room
          if (isRecordingRef.current) {
            void stopAndPost().catch(() => {});
          }
          // Navigate out first so the host doesn't see the ROOM_DELETED alert
          // that fires for all participants. deleteRoom runs best-effort in background.
          onLeave();
          client.deleteRoom(roomName).catch(() => {});
        },
      },
    ]);
  }, [client, roomName, onLeave, stopAndPost]);

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
    <KeyboardAvoidingView
      style={styles.inner}
      behavior='padding'
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <IconButton
          name='arrow-left'
          size={20}
          color={theme.text}
          onPress={handleLeaveWithCleanup}
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
        messages={chatMessages}
        onSend={handleSendChat}
        onClose={() => setChatVisible(false)}
        colors={colors}
      />

      {/* Controls */}
      <RoomControls
        isHost={isHost}
        hasRaisedHand={hasRaisedHand}
        onToggleMute={handleToggleMute}
        onToggleHand={handleToggleHand}
        onToggleChat={() => {
          setChatVisible((v) => {
            if (!v) setUnreadChatCount(0);
            return !v;
          });
        }}
        hasUnreadChat={unreadChatCount > 0}
        isRecording={visibleRecordingState}
        isUploading={isUploading}
        onToggleRecording={handleToggleRecording}
        recordingStartedAt={recordingStartedAt}
        onLeave={handleLeaveWithCleanup}
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
    </KeyboardAvoidingView>
  );
}

// ─── Outer screen — sets up LiveKitRoom provider ───────────────────────────

export default function HangoutsRoomScreen(): React.ReactElement {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const router = useRouter();
  const { roomName, livekitToken, isHost: isHostParam, roomTitle: titleParam, roomHost: hostParam, roomDescription: descriptionParam } = useLocalSearchParams<{
    roomName: string;
    livekitToken: string;
    isHost: string;
    roomTitle: string;
    roomHost: string;
    roomDescription: string;
  }>();
  const isHost = isHostParam === 'true';

  const [connectionState, setConnectionState] = useState<ConnectionState | 'idle'>('idle');
  // Prevent double-navigation: RoomScreenInner handles server-initiated disconnects;
  // onDisconnected fallback fires after, but only navigates if we haven't left yet.
  const hasLeftRef = useRef(false);
  // On Android we must resolve mic permission before LiveKitRoom mounts,
  // otherwise LiveKit tries to open the mic while the dialog is still pending.
  const [permissionReady, setPermissionReady] = useState(Platform.OS !== 'android');

  // Request Android mic permission — gate LiveKitRoom until resolved
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).then((result) => {
      if (cancelled) return;
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
    return () => { cancelled = true; };
  }, [router]);

  // Configure audio session
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => { void AudioSession.stopAudioSession(); };
  }, []);

  const handleLeave = useCallback((): void => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    router.back();
  }, [router]);

  if (!livekitToken || !roomName) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Invalid room parameters.</Text>
      </SafeAreaView>
    );
  }

  const displayTitle = titleParam || roomName;
  const displayHost = hostParam || '';

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
        audio={isHost}
        video={false}
        onConnected={() => setConnectionState('connected' as ConnectionState)}
        onDisconnected={
          // LiveKit's implementation calls onDisconnected(reason) even though the
          // TS type declares () => void — cast so we can read the reason.
          ((reason?: DisconnectReason) => {
            setConnectionState('disconnected' as ConnectionState);
            // If we already navigated away (e.g. host ended the room, user pressed Leave),
            // don't show a redundant alert or navigate twice.
            if (hasLeftRef.current) return;
            if (reason === DisconnectReason.ROOM_DELETED) {
              Alert.alert('Hangout ended', 'The host has ended this hangout.', [
                { text: 'OK', onPress: handleLeave },
              ]);
            } else if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
              Alert.alert('Removed', 'You were removed from this hangout.', [
                { text: 'OK', onPress: handleLeave },
              ]);
            } else {
              // CLIENT_INITIATED, UNKNOWN_REASON, SERVER_SHUTDOWN — leave silently.
              handleLeave();
            }
          }) as () => void
        }
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
            roomDescription={descriptionParam ?? ''}
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
