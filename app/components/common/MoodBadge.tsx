import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { moodBadgeImageUrl, type MoodBadgeSku } from '../../../services/moodBadgeService';

interface Props {
  sku: MoodBadgeSku;
  /** Diameter in points. */
  size: number;
  /** Ring color behind the badge, usually the screen's background. */
  ringColor: string;
  /** Distance from the wrapper's bottom-right corner. Large round avatars
   *  need it positive so the badge sits on the circle, not off its corner. */
  offset?: number;
}

/**
 * A mood badge on the bottom-right corner of an avatar, like on snapie.io.
 * Place it inside a `position: 'relative'` wrapper around the avatar. The
 * avatar's accessibility label should say "feeling …" (see moodSpoken).
 */
export const MoodBadge: React.FC<Props> = ({ sku, size, ringColor, offset = -3 }) => (
  <View
    pointerEvents="none"
    accessible={false}
    importantForAccessibility="no-hide-descendants"
    style={[
      styles.ring,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: ringColor, borderColor: ringColor, right: offset, bottom: offset },
    ]}
  >
    <ExpoImage
      source={{ uri: moodBadgeImageUrl(sku, size <= 20 ? 64 : 128) }}
      style={{ width: size - 2, height: size - 2, borderRadius: (size - 2) / 2 }}
      contentFit="contain"
      cachePolicy="memory-disk"
    />
  </View>
);

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
