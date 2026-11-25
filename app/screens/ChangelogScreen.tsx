import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { getAppVersion, loadChangelog, setLastSeenVersion } from '../../services/changelogService';
import { entriesForApp, type ChangelogEntry } from '../../utils/changelog';
import { ChangelogEntries } from '../components/changelog/ChangelogEntries';

/** Every version's notes up to the installed one. */
const ChangelogScreen = (): React.JSX.Element => {
    const theme = useTheme();
    const router = useRouter();
    const appVersion = getAppVersion();
    const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

    // Opening the notes counts as seeing them: clears the "New" dot on Profile.
    useEffect(() => {
        void setLastSeenVersion(appVersion);
    }, [appVersion]);

    useEffect(() => {
        let cancelled = false;
        loadChangelog().then((all) => {
            if (!cancelled) setEntries(entriesForApp(all, appVersion));
        });
        return () => {
            cancelled = true;
        };
    }, [appVersion]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
                    <FontAwesome name="chevron-left" size={18} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>What’s new</Text>
                <View style={{ width: 18 }} />
            </View>
            {entries === null ? (
                <ActivityIndicator style={styles.status} color={theme.icon} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {entries.length > 0 ? (
                        <ChangelogEntries entries={entries} colors={theme} />
                    ) : (
                        <Text style={[styles.empty, { color: theme.textSecondary }]}>No release notes yet.</Text>
                    )}
                    <Text style={[styles.footer, { color: theme.textSecondary }]}>You’re on HiveSnaps {appVersion}.</Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

export default ChangelogScreen;

export const options = { headerShown: false };

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    status: { marginTop: 40 },
    content: { padding: 16, paddingBottom: 40 },
    empty: { fontSize: 14, textAlign: 'center', marginTop: 24 },
    footer: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
