import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  live: boolean;
  onToggle: () => void;
  sound: boolean;
  onToggleSound: () => void;
  colors: { text: string; icon: string; border: string };
}

/** Live toggle + sound toggle for a Snap-Cast (a thread that follows replies live). */
export default function SnapCastBar({ live, onToggle, sound, onToggleSound, colors }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.live, live ? styles.liveOn : { borderColor: colors.border }]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: live }}
        accessibilityLabel={live ? 'Stop live mode' : 'Go live'}
      >
        <Text style={{ color: live ? '#fff' : colors.text, fontWeight: '600' }}>{live ? '● Live' : 'Go live'}</Text>
      </TouchableOpacity>
      {live && (
        <TouchableOpacity
          onPress={onToggleSound}
          accessibilityRole="button"
          accessibilityLabel={sound ? 'Mute new-snap sound' : 'Play sound on new snaps'}
        >
          <Ionicons name={sound ? 'volume-high' : 'volume-mute'} size={20} color={colors.icon} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  live: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  liveOn: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
});
