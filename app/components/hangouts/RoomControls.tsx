import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  onLeave,
  onEndRoom,
  colors,
}: RoomControlsProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { localParticipant } = useLocalParticipant();
  const isMuted = !localParticipant?.isMicrophoneEnabled;
  const isListener = localParticipant?.permissions?.canPublish === false;

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

      {/* Chat */}
      <IconButton
        name='comment-o'
        size={22}
        color={colors.icon}
        onPress={onToggleChat}
        accessibilityLabel='Toggle chat'
      />

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
