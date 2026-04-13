import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useParticipants, useLocalParticipant } from '@livekit/react-native';
import ParticipantTile from './ParticipantTile';

interface SpeakerStageProps {
  activeSpeakerIdentities: string[];
  raisedHandIdentities: string[];
  colors: {
    text: string;
    textSecondary: string;
    success: string;
    card: string;
    border: string;
  };
}

export default function SpeakerStage({
  activeSpeakerIdentities,
  raisedHandIdentities,
  colors,
}: SpeakerStageProps): React.ReactElement {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Speakers = host + those who can publish (have microphone track or canPublishSources includes mic)
  const speakers = participants.filter((p) => p.permissions?.canPublish !== false);
  const hasLocal = localParticipant?.permissions?.canPublish !== false;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {speakers.length + (hasLocal ? 1 : 0) === 0 ? 'No speakers yet' : 'Speakers'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Local participant (if speaker) */}
        {hasLocal && localParticipant && (
          <ParticipantTile
            key='local'
            identity={localParticipant.identity}
            isMuted={!localParticipant.isMicrophoneEnabled}
            isSpeaking={activeSpeakerIdentities.includes(localParticipant.identity)}
            hasRaisedHand={false}
            size='large'
            colors={colors}
          />
        )}
        {/* Remote speakers */}
        {speakers.map((p) => (
          <ParticipantTile
            key={p.identity}
            identity={p.identity}
            isMuted={!p.isMicrophoneEnabled}
            isSpeaking={activeSpeakerIdentities.includes(p.identity)}
            hasRaisedHand={raisedHandIdentities.includes(p.identity)}
            size='large'
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginLeft: 16, marginBottom: 12 },
  scroll: { paddingHorizontal: 16, gap: 16 },
});
