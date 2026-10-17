import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutedTags } from '../../hooks/useMutedTags';

interface Props {
  colors: { text: string; textSecondary: string; bubble: string; border: string; icon: string };
}

/** Chip editor for hashtags the user never wants to see in feeds. */
export default function MutedTagsEditor({ colors }: Props): React.JSX.Element {
  const { mutedTags, addTag, removeTag } = useMutedTags();
  const [draft, setDraft] = useState('');

  const submit = (): void => {
    addTag(draft);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Muted hashtags</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Hide snaps and posts with these tags without muting the author.
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bubble }]}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        placeholder="#tag, then press enter"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel="Add muted hashtag"
      />
      <View style={styles.chips}>
        {mutedTags.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[styles.chip, { backgroundColor: colors.bubble, borderColor: colors.border }]}
            onPress={() => removeTag(tag)}
            accessibilityRole="button"
            accessibilityLabel={`Unmute #${tag}`}
          >
            <Text style={{ color: colors.text }}>#{tag}</Text>
            <Ionicons name="close" size={14} color={colors.icon} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
});
