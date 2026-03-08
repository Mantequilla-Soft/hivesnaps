import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../../styles/colors';

type Tone = 'default' | 'danger';

export interface ActionItem {
  label: string;
  onPress: () => void;
  tone?: Tone;
  accessibilityLabel?: string;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionItem[];
  colors?: {
    bubble: string;
    border: string;
    text: string;
  };
}

const ActionSheet: React.FC<ActionSheetProps> = ({ visible, onClose, items, colors }) => {
  const appColors = useAppColors();
  const insets = useSafeAreaInsets();
  const c = colors || { text: appColors.text, bubble: appColors.bubble, border: appColors.border };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.bubble, borderColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={`${item.label}-${idx}`}
              onPress={item.onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel || item.label}
            >
              <Text style={[styles.itemText, item.tone === 'danger' ? styles.danger : { color: c.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} style={[styles.item, styles.cancel]} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={[styles.itemText, { color: c.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  danger: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  cancel: {
    marginTop: 6,
  },
});

export default ActionSheet;
