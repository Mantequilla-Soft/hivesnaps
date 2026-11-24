import React, { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { ChangelogEntries } from './ChangelogEntries';
import type { ChangelogEntry } from '../../../utils/changelog';

interface Props {
    visible: boolean;
    entries: readonly ChangelogEntry[];
    onDismiss: () => void;
}

/** "What's new" after an update, shown once per version (see useWhatsNew). */
export const WhatsNewSheet: React.FC<Props> = ({ visible, entries, onDismiss }) => {
    const theme = useTheme();
    const router = useRouter();

    // Navigating while the iOS Modal is still animating closed can be
    // dropped, so on iOS the push waits for the Modal's own onDismiss (which
    // fires once it's gone). Android has no such callback, and no such issue.
    const pendingChangelogRef = useRef(false);
    const pushChangelog = (): void => {
        pendingChangelogRef.current = false;
        router.push('/screens/ChangelogScreen');
    };

    const openChangelog = (): void => {
        onDismiss();
        if (Platform.OS === 'ios') pendingChangelogRef.current = true;
        else pushChangelog();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
            onDismiss={() => {
                if (pendingChangelogRef.current) pushChangelog();
            }}
        >
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Text style={[styles.heading, { color: theme.text }]}>What’s new</Text>
                    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                        <ChangelogEntries entries={entries} colors={theme} />
                    </ScrollView>
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={openChangelog} accessibilityRole="button">
                            <Text style={[styles.link, { color: theme.textSecondary }]}>Full changelog</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onDismiss}
                            style={[styles.button, { backgroundColor: theme.button }]}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, maxHeight: '80%', paddingTop: 18 },
    heading: { fontSize: 20, fontWeight: '700', paddingHorizontal: 18, marginBottom: 8 },
    scroll: { flexGrow: 0 },
    scrollContent: { paddingHorizontal: 18, paddingTop: 4 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingHorizontal: 18 },
    link: { fontSize: 14, fontWeight: '600' },
    button: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
    buttonText: { fontSize: 15, fontWeight: '700' },
});
