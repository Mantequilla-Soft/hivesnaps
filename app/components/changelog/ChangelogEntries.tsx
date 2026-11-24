import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChangelogEntry, ChangelogItemType } from '../../../utils/changelog';

const TYPE_LABEL: Record<ChangelogItemType, string> = { feature: 'New', improvement: 'Better', fix: 'Fixed' };

interface Props {
    entries: readonly ChangelogEntry[];
    colors: { text: string; textSecondary: string; success: string; button: string; warning: string };
}

function formatDate(iso: string): string {
    const d = new Date(`${iso}T12:00:00Z`);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Version headings with their tagged items; shared by the sheet and the screen. */
export const ChangelogEntries: React.FC<Props> = ({ entries, colors }) => {
    const tagColor: Record<ChangelogItemType, string> = { feature: colors.button, improvement: colors.success, fix: colors.warning };
    return (
        <View>
            {entries.map((entry) => (
                <View key={entry.version} style={styles.entry}>
                    <Text style={[styles.version, { color: colors.text }]}>
                        Version {entry.version}
                        <Text style={[styles.date, { color: colors.textSecondary }]}>  ·  {formatDate(entry.date)}</Text>
                    </Text>
                    {entry.title ? <Text style={[styles.title, { color: colors.textSecondary }]}>{entry.title}</Text> : null}
                    {entry.items.map((item, i) => (
                        <View key={i} style={styles.item}>
                            <Text style={[styles.tag, { color: tagColor[item.type], borderColor: tagColor[item.type] }]}>
                                {TYPE_LABEL[item.type]}
                            </Text>
                            <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    entry: { marginBottom: 20 },
    version: { fontSize: 16, fontWeight: '700' },
    date: { fontSize: 13, fontWeight: '400' },
    title: { fontSize: 13, marginTop: 2, marginBottom: 4 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
    tag: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginTop: 2,
        minWidth: 44,
        textAlign: 'center',
        overflow: 'hidden',
    },
    text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
