import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalParticipant } from '@livekit/react-native';
import IconButton from '../IconButton';
import PrimaryButton from '../PrimaryButton';

interface RoomControlsProps {
  isHost: boolean;
  hasRaisedHand: boolean;
  onToggleMute: () => void;
  onToggleHand: () => void;
  onToggleChat: () => void;
  hasUnreadChat: boolean;
  isRecording: boolean;
  isUploading: boolean;
  onToggleRecording: () => void;
  onLeave: () => void;
  onEndRoom: () => void;
  colors: {
    text: string;
    textSecondary: string;
    icon: string;
    card: string;
    border: string;
    button: string;
    buttonText: string;
    error: string;
  };
}

export default function RoomControls({
  isHost,
  hasRaisedHand,
  onToggleMute,
  onToggleHand,
  onToggleChat,
  hasUnreadChat,
  isRecording,
  isUploading,
  onToggleRecording,
  onLeave,
  onEndRoom,
  colors,
}: RoomControlsProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { localParticipant } = useLocalParticipant();
  const isMuted = !localParticipant?.isMicrophoneEnabled;
  const isListener = localParticipant?.permissions?.canPublish === false;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const elapsed = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 },
      ]}
    >
      {/* Mute/unmute — only for speakers and host */}
      {!isListener && (
        <IconButton
          name={isMuted ? 'microphone-slash' : 'microphone'}
          size={22}
          color={isMuted ? colors.textSecondary : colors.button}
          onPress={onToggleMute}
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        />
      )}

      {/* Raise / lower hand — listeners only */}
      {isListener && (
        <IconButton
          name='hand-paper-o'
          size={22}
          color={hasRaisedHand ? colors.button : colors.icon}
          backgroundColor={hasRaisedHand ? `${colors.button}22` : undefined}
          onPress={onToggleHand}
          accessibilityLabel={hasRaisedHand ? 'Lower hand' : 'Raise hand to speak'}
        />
      )}

      {/* REC badge — visible to all while recording is active */}
      {isRecording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC {elapsed}</Text>
        </View>
      )}

      {/* Upload spinner — shown to host while audio is being uploaded */}
      {isUploading && (
        <ActivityIndicator size='small' color='#EF4444' />
      )}

      {/* Record / Stop — host only */}
      {isHost && !isUploading && (
        <IconButton
          name={isRecording ? 'stop-circle' : 'circle'}
          size={22}
          color={isRecording ? '#EF4444' : colors.icon}
          backgroundColor={isRecording ? '#EF444422' : undefined}
          onPress={onToggleRecording}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        />
      )}

      {/* Chat */}
      <View style={styles.chatBtnWrap}>
        <IconButton
          name='comment-o'
          size={22}
          color={hasUnreadChat ? colors.button : colors.icon}
          onPress={onToggleChat}
          accessibilityLabel={hasUnreadChat ? 'Toggle chat (unread messages)' : 'Toggle chat'}
        />
        {hasUnreadChat && <View style={styles.unreadDot} />}
      </View>

      {/* Leave */}
      <IconButton
        name='phone'
        size={20}
        color='#fff'
        backgroundColor='#EF4444'
        onPress={onLeave}
        style={styles.leaveBtn}
        accessibilityLabel='Leave room'
      />

      {/* End room — host only */}
      {isHost && (
        <PrimaryButton
          label='End'
          variant='primary'
          backgroundColor='#EF4444'
          textColor='#fff'
          onPress={onEndRoom}
          style={styles.endBtn}
          accessibilityHint='Ends the room for all participants'
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 14,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EF444422',
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  chatBtnWrap: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  leaveBtn: {
    transform: [{ rotate: '135deg' }],
  },
  endBtn: {
    flex: 0,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 4,
  },
});
