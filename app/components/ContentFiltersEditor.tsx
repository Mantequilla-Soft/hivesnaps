import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContentFilter } from '@snapie/content-filter/react';
import { describeRule, ruleKey } from '@snapie/content-filter';
import { contentFilterStore } from '../../services/contentFilter';
import { parseRuleInput } from '../../utils/contentFilterInput';

interface Props {
  colors: {
    text: string;
    textSecondary: string;
    bubble: string;
    border: string;
    icon: string;
    button?: string;
    error?: string;
  };
}

/**
 * Content filters: presets like "Hide game results", plus the user's own
 * rules (#tag, app:name, app:name #tag). Synced with snapie.io for the
 * signed-in account.
 */
export default function ContentFiltersEditor({ colors }: Props): React.JSX.Element {
  const { prefs, catalog, addRule, removeRule, setPreset } = useContentFilter(contentFilterStore);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    if (!draft.trim()) return;
    const parsed = parseRuleInput(draft);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    addRule(parsed.rule);
    setDraft('');
    setError(null);
  };

  const presets = Object.values(catalog);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Content filters</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Hide snaps and posts by tag or by the app they were posted from, without muting the author.
        Synced with snapie.io.
      </Text>

      {presets.map(preset => {
        const on = prefs.presets.includes(preset.id);
        return (
          <View key={preset.id} style={[styles.preset, { borderColor: colors.border }]}>
            <View style={styles.presetText}>
              <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
              {preset.description ? (
                <Text style={[styles.presetDescription, { color: colors.textSecondary }]}>
                  {preset.description}
                </Text>
              ) : null}
            </View>
            <Switch
              value={on}
              onValueChange={value => setPreset(preset.id, value)}
              accessibilityLabel={preset.label}
              trackColor={colors.button ? { true: colors.button, false: colors.border } : undefined}
            />
          </View>
        );
      })}

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bubble }]}
        value={draft}
        onChangeText={text => {
          setDraft(text);
          if (error) setError(null);
        }}
        onSubmitEditing={submit}
        placeholder="#tag, app:name or app:name #tag"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel="Add a content filter"
        accessibilityHint="Type a hashtag, app:name, or app:name followed by a hashtag, then press done"
      />
      {error ? <Text style={[styles.error, { color: colors.error ?? '#E74C3C' }]}>{error}</Text> : null}

      <View style={styles.chips}>
        {prefs.rules.map(rule => {
          const label = describeRule(rule);
          return (
            <TouchableOpacity
              key={ruleKey(rule)}
              style={[styles.chip, { backgroundColor: colors.bubble, borderColor: colors.border }]}
              onPress={() => removeRule(rule)}
              accessibilityRole="button"
              accessibilityLabel={`Stop hiding ${label}`}
            >
              <Text style={{ color: colors.text }}>{label}</Text>
              <Ionicons name="close" size={14} color={colors.icon} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 13, marginBottom: 10 },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  presetText: { flex: 1 },
  presetLabel: { fontSize: 15, fontWeight: '600' },
  presetDescription: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  error: { fontSize: 12, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
