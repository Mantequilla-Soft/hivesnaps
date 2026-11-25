import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Linking,
    Alert,
    StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { useFeedbackForm } from '../../hooks/useFeedbackForm';
import { FEEDBACK_MESSAGE_MAX, FEEDBACK_TITLE_MAX, type FeedbackCategory } from '../../services/feedbackService';

const CATEGORIES: { key: FeedbackCategory; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
    { key: 'bug', label: 'Bug', icon: 'bug' },
    { key: 'idea', label: 'Idea', icon: 'lightbulb-o' },
    { key: 'other', label: 'Other', icon: 'comment-o' },
];

/**
 * Send feedback (snapie.io's FeedbackModal): a bug, idea or anything else,
 * with an optional screenshot. It becomes a GitHub issue the team reads.
 */
const FeedbackScreen = (): React.JSX.Element => {
    const theme = useTheme();
    const router = useRouter();
    const navigation = useNavigation();
    const { currentUsername } = useAuth();
    const form = useFeedbackForm(currentUsername ?? null);
    const { category, setCategory, title, setTitle, body, setBody, screenshot, stage, error, sent, busy, dirty, canSend } = form;

    // Any way of leaving (Cancel, Android Back, the iOS swipe) asks before
    // throwing away an unsent note, and waits while one is being sent.
    usePreventRemove(!sent && (dirty || busy), ({ data }) => {
        if (busy) return;
        Alert.alert('Discard feedback?', 'Your note hasn’t been sent.', [
            { text: 'Keep writing', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
        ]);
    });

    const attach = async (): Promise<void> => {
        const result = await form.attach();
        if (!result.ok && result.problem) Alert.alert('Can’t attach that image', result.problem);
    };

    const close = (): void => {
        if (!busy) router.back();
    };

    const stageLabel = stage === 'uploading' ? 'Uploading screenshot…' : stage === 'sending' ? 'Sending…' : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={close} style={styles.headerButton} accessibilityRole="button" disabled={busy}>
                        <Text style={[styles.headerButtonText, { color: theme.text }]}>{sent ? 'Done' : 'Cancel'}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.text }]}>Send feedback</Text>
                    {sent ? (
                        <View style={styles.headerButton} />
                    ) : (
                        <TouchableOpacity
                            onPress={form.send}
                            disabled={!canSend}
                            style={[
                                styles.sendButton,
                                { backgroundColor: canSend ? theme.button : theme.buttonInactive },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Send feedback"
                        >
                            {busy ? (
                                <ActivityIndicator size="small" color={theme.buttonText} />
                            ) : (
                                <Text style={[styles.sendText, { color: theme.buttonText }]}>Send</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {sent ? (
                    <View style={styles.sent}>
                        <FontAwesome name="check-circle" size={48} color={theme.success} />
                        <Text style={[styles.sentTitle, { color: theme.text }]}>Thanks! We got it.</Text>
                        <Text style={[styles.sentText, { color: theme.textSecondary }]}>
                            Your note is now an issue the team reads. You can follow it on GitHub.
                        </Text>
                        {sent.issueUrl ? (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(sent.issueUrl!).catch(() => {})}
                                style={[styles.linkButton, { borderColor: theme.button }]}
                                accessibilityRole="link"
                            >
                                <Text style={[styles.linkText, { color: theme.button }]}>View on GitHub</Text>
                                <FontAwesome name="external-link" size={12} color={theme.button} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        <View style={styles.categories}>
                            {CATEGORIES.map((c) => {
                                const selected = c.key === category;
                                return (
                                    <Pressable
                                        key={c.key}
                                        onPress={() => setCategory(c.key)}
                                        disabled={busy}
                                        style={[
                                            styles.category,
                                            { borderColor: selected ? theme.button : theme.inputBorder },
                                            selected && { backgroundColor: theme.button },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                    >
                                        <FontAwesome name={c.icon} size={14} color={selected ? theme.buttonText : theme.icon} />
                                        <Text style={[styles.categoryText, { color: selected ? theme.buttonText : theme.text }]}>{c.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.inputBorder }]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder={category === 'bug' ? 'What went wrong?' : category === 'idea' ? 'Your idea in a few words' : 'Title'}
                            placeholderTextColor={theme.placeholderText}
                            maxLength={FEEDBACK_TITLE_MAX}
                            editable={!busy}
                            accessibilityLabel="Title"
                        />
                        <TextInput
                            style={[styles.input, styles.message, { color: theme.text, borderColor: theme.inputBorder }]}
                            value={body}
                            onChangeText={setBody}
                            placeholder={
                                category === 'bug'
                                    ? 'What did you do, what happened, and what did you expect?'
                                    : 'Tell us more'
                            }
                            placeholderTextColor={theme.placeholderText}
                            maxLength={FEEDBACK_MESSAGE_MAX}
                            multiline
                            textAlignVertical="top"
                            editable={!busy}
                            accessibilityLabel="Message"
                        />

                        {screenshot ? (
                            <View style={[styles.preview, { borderColor: theme.inputBorder }]}>
                                <ExpoImage source={{ uri: screenshot.uri }} style={styles.previewImage} contentFit="cover" />
                                <TouchableOpacity
                                    onPress={form.removeScreenshot}
                                    disabled={busy}
                                    style={styles.removeScreenshot}
                                    accessibilityRole="button"
                                    accessibilityLabel="Remove screenshot"
                                >
                                    <FontAwesome name="times-circle" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={attach}
                                disabled={busy}
                                style={[styles.attach, { borderColor: theme.inputBorder }]}
                                accessibilityRole="button"
                            >
                                <FontAwesome name="image" size={16} color={theme.icon} />
                                <Text style={[styles.attachText, { color: theme.text }]}>Attach a screenshot (optional)</Text>
                            </TouchableOpacity>
                        )}

                        {stageLabel ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{stageLabel}</Text> : null}
                        {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
                        <Text style={[styles.hint, { color: theme.textSecondary }]}>
                            Your note becomes a public GitHub issue the team reads, with your username and app version.
                            Screenshots are uploaded publicly too, so leave out anything private.
                        </Text>
                    </ScrollView>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default FeedbackScreen;

export const options = { headerShown: false };

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: { paddingVertical: 6, minWidth: 64 },
    headerButtonText: { fontSize: 16 },
    title: { fontSize: 17, fontWeight: '700' },
    sendButton: { minWidth: 64, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, alignItems: 'center' },
    sendText: { fontSize: 15, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 40 },
    categories: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    category: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
    categoryText: { fontSize: 14, fontWeight: '600' },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
    message: { minHeight: 140 },
    attach: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 14, marginBottom: 12 },
    attachText: { fontSize: 14 },
    preview: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
    previewImage: { width: '100%', height: 200 },
    removeScreenshot: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, padding: 3 },
    hint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
    error: { fontSize: 13, marginTop: 4 },
    sent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    sentTitle: { fontSize: 20, fontWeight: '700' },
    sentText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
    linkText: { fontSize: 14, fontWeight: '600' },
});
