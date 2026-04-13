import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useParticipants, useLocalParticipant } from '@livekit/react-native';
import { FontAwesome } from '@expo/vector-icons';
import ParticipantTile from './ParticipantTile';

interface AudienceSectionProps {
  isHost: boolean;
  raisedHandIdentities: string[];
  activeSpeakerIdentities: string[];
  onApprove: (identity: string) => void;
  onDeny: (identity: string) => void;
  onLongPress: (identity: string) => void;
  colors: {
    text: string;
    textSecondary: string;
    success: string;
    card: string;
    border: string;
    button: string;
    buttonText: string;
  };
}

export default function AudienceSection({
  isHost,
  raisedHandIdentities,
  activeSpeakerIdentities,
  onApprove,
  onDeny,
  onLongPress,
  colors,
}: AudienceSectionProps): React.ReactElement {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Audience = those who cannot publish (listeners). useParticipants() includes
  // local participant, so exclude it to avoid duplicates with our manual entry.
  const audience = participants.filter(
    (p) => p.permissions?.canPublish === false && p.identity !== localParticipant?.identity
  );
  const localIsAudience = localParticipant?.permissions?.canPublish === false;

  type AudienceEntry = { identity: string; isMicrophoneEnabled: boolean; isLocal: boolean };
  const allAudience: AudienceEntry[] = [
    ...(localIsAudience && localParticipant
      ? [{ identity: localParticipant.identity, isMicrophoneEnabled: localParticipant.isMicrophoneEnabled, isLocal: true }]
      : []),
    ...audience.map((p) => ({ identity: p.identity, isMicrophoneEnabled: p.isMicrophoneEnabled, isLocal: false })),
  ];

  if (allAudience.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No listeners yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Audience · {allAudience.length}
      </Text>
      <FlatList
        data={allAudience}
        keyExtractor={(item) => item.identity}
        numColumns={4}
        scrollEnabled={false}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const hasHand = raisedHandIdentities.includes(item.identity);
          return (
            <View style={styles.tileWrap}>
              <Pressable
                onLongPress={() => !item.isLocal && onLongPress(item.identity)}
              >
                <ParticipantTile
                  identity={item.identity}
                  isMuted={!item.isMicrophoneEnabled}
                  isSpeaking={activeSpeakerIdentities.includes(item.identity)}
                  hasRaisedHand={hasHand}
                  size='small'
                  colors={colors}
                />
              </Pressable>
              {/* Host approve/deny controls on raised hands */}
              {isHost && hasHand && (
                <View style={styles.approveRow}>
                  <Pressable
                    style={[styles.approveBtn, { backgroundColor: colors.success }]}
                    onPress={() => onApprove(item.identity)}
                    accessibilityRole='button'
                    accessibilityLabel={`Approve ${item.identity} to speak`}
                  >
                    <FontAwesome name='check' size={10} color='#fff' />
                  </Pressable>
                  <Pressable
                    style={[styles.denyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => onDeny(item.identity)}
                    accessibilityRole='button'
                    accessibilityLabel={`Deny ${item.identity}`}
                  >
                    <FontAwesome name='times' size={10} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  grid: { gap: 12 },
  tileWrap: { flex: 1 / 4, alignItems: 'center' },
  approveRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  approveBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  denyBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 24 },
  emptyText: { fontSize: 13 },
});
