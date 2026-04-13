import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';

interface HostControlsPanelProps {
  identity: string | null;
  onPromote: (identity: string) => void;
  onMute: (identity: string) => void;
  onKick: (identity: string) => void;
  onClose: () => void;
  colors: {
    text: string;
    textSecondary: string;
    card: string;
    border: string;
    error: string;
    success: string;
  };
}

export default function HostControlsPanel({
  identity,
  onPromote,
  onMute,
  onKick,
  onClose,
  colors,
}: HostControlsPanelProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  const actions = [
    { icon: 'arrow-up' as const, label: 'Invite to speak', color: colors.success, onPress: () => identity && onPromote(identity) },
    { icon: 'microphone-slash' as const, label: 'Mute', color: colors.text, onPress: () => identity && onMute(identity) },
    { icon: 'ban' as const, label: 'Remove from room', color: colors.error, onPress: () => identity && onKick(identity) },
  ];

  return (
    <Modal visible={!!identity} transparent animationType='slide' onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.textSecondary }]}>@{identity}</Text>

          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={[styles.action, { borderBottomColor: colors.border }]}
              onPress={() => { action.onPress(); onClose(); }}
              accessibilityRole='button'
              accessibilityLabel={action.label}
            >
              <FontAwesome name={action.icon} size={18} color={action.color} style={styles.actionIcon} />
              <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
            </Pressable>
          ))}

          <Pressable
            style={styles.cancel}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Cancel'
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: { width: 28 },
  actionLabel: { fontSize: 16 },
  cancel: { paddingVertical: 16, alignItems: 'center' },
  cancelText: { fontSize: 16 },
});
