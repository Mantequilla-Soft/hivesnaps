import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ParticipantTileProps {
  identity: string;
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand?: boolean;
  size?: 'large' | 'small';
  colors: {
    text: string;
    textSecondary: string;
    success: string;
    card: string;
  };
}

export default function ParticipantTile({
  identity,
  isMuted,
  isSpeaking,
  hasRaisedHand = false,
  size = 'large',
  colors,
}: ParticipantTileProps): React.ReactElement {
  const avatarSize = size === 'large' ? 64 : 44;
  const ringSize = avatarSize + 10;

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSpeaking ? 1.12 : 1.0, { damping: 10, stiffness: 120 }) }],
    opacity: withSpring(isSpeaking ? 1 : 0, { damping: 10 }),
  }));

  return (
    <View style={[styles.container, size === 'small' && styles.containerSmall]}>
      <View style={styles.avatarWrap}>
        {/* Speaking ring */}
        <Animated.View
          style={[
            styles.ring,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.success },
            ringStyle,
          ]}
        />
        <ExpoImage
          source={{ uri: `https://images.hive.blog/u/${identity}/avatar/sm` }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          contentFit='cover'
        />
        {/* Raised hand badge */}
        {hasRaisedHand && (
          <View style={[styles.handBadge, { backgroundColor: colors.card }]}>
            <Text style={styles.handEmoji}>✋</Text>
          </View>
        )}
        {/* Muted indicator */}
        {isMuted && (
          <View style={[styles.mutedBadge, { backgroundColor: colors.card }]}>
            <FontAwesome name='microphone-slash' size={10} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <Text style={[styles.name, { color: colors.text }, size === 'small' && styles.nameSmall]} numberOfLines={1}>
        @{identity}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: 80 },
  containerSmall: { width: 60 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  avatar: {},
  handBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    padding: 2,
  },
  handEmoji: { fontSize: 12 },
  mutedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 8,
    padding: 3,
  },
  name: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  nameSmall: { fontSize: 10 },
});
