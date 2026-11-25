import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { getAvatarImageUrl } from '../../services/AvatarService';

interface Props {
    suggestions: string[];
    unknownMentions: string[];
    onPick: (name: string) => void;
    colors: { text: string; inputBg: string; inputBorder: string; error: string };
}

/**
 * Under the composer's text box: a row of @username chips for the mention
 * being typed (one line, so it stays above the keyboard), and a note for
 * finished mentions that aren't Hive accounts.
 */
const MentionSuggestions: React.FC<Props> = ({ suggestions, unknownMentions, onPick, colors }) => {
    if (suggestions.length === 0 && unknownMentions.length === 0) return null;
    return (
        <View style={styles.container}>
            {suggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.row}>
                    {suggestions.map((name) => (
                        <TouchableOpacity
                            key={name}
                            onPress={() => onPick(name)}
                            style={[styles.chip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                            accessibilityRole="button"
                            accessibilityLabel={`Mention @${name}`}
                        >
                            <ExpoImage source={{ uri: getAvatarImageUrl(name) }} style={styles.avatar} />
                            <Text style={[styles.name, { color: colors.text }]}>@{name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
            {unknownMentions.length > 0 && (
                <Text style={[styles.unknown, { color: colors.error }]}>
                    {unknownMentions.map((n) => `@${n}`).join(', ')}{' '}
                    {unknownMentions.length === 1 ? "isn't a Hive account" : "aren't Hive accounts"}
                </Text>
            )}
        </View>
    );
};

export default MentionSuggestions;

const styles = StyleSheet.create({
    container: { marginBottom: 12 },
    row: { gap: 8, paddingVertical: 2 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
    avatar: { width: 24, height: 24, borderRadius: 12 },
    name: { fontSize: 14, fontWeight: '600' },
    unknown: { fontSize: 12, marginTop: 6 },
});
