import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StyleSheet,
    type KeyboardTypeOptions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { useEditProfile, type ProfileImageKind } from '../../hooks/useEditProfile';
import { markProfileSaved } from '../../services/ProfileService';
import { PROFILE_LIMITS, type ProfileFields } from '../../utils/profileMetadata';

/**
 * Edit your Hive profile: display name, about, location, website, avatar and
 * cover image (snapie.io's EditProfileModal). Saved with the posting key.
 */
const EditProfileScreen = (): React.JSX.Element => {
    const theme = useTheme();
    const router = useRouter();
    const { currentUsername } = useAuth();
    const profile = useEditProfile(currentUsername);
    const { fields, uploading, saving, dirty, error } = profile;
    const busy = saving || uploading !== null;

    const changeImage = async (kind: ProfileImageKind): Promise<void> => {
        try {
            await profile.changeImage(kind);
        } catch (err) {
            Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
        }
    };

    const save = async (): Promise<void> => {
        try {
            await profile.save();
            if (currentUsername) markProfileSaved(currentUsername);
            router.back();
        } catch (err) {
            Alert.alert('Couldn’t save your profile', err instanceof Error ? err.message : 'Please try again.');
        }
    };

    const cancel = (): void => {
        if (!dirty || saving) {
            router.back();
            return;
        }
        Alert.alert('Discard changes?', 'Your profile changes haven’t been saved.', [
            { text: 'Keep editing', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]);
    };

    const field = (
        key: keyof ProfileFields,
        label: string,
        options: { placeholder: string; max: number; multiline?: boolean; keyboardType?: KeyboardTypeOptions; autoCapitalize?: 'none' | 'sentences' | 'words' }
    ): React.JSX.Element => (
        <View style={styles.field}>
            <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.counter, { color: theme.textSecondary }]}>
                    {fields[key].length}/{options.max}
                </Text>
            </View>
            <TextInput
                style={[
                    styles.input,
                    options.multiline && styles.multiline,
                    { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.background },
                ]}
                value={fields[key]}
                onChangeText={(v) => profile.setField(key, v)}
                placeholder={options.placeholder}
                placeholderTextColor={theme.placeholderText}
                maxLength={options.max}
                multiline={options.multiline}
                textAlignVertical={options.multiline ? 'top' : 'center'}
                keyboardType={options.keyboardType}
                autoCapitalize={options.autoCapitalize ?? 'sentences'}
                autoCorrect={options.keyboardType !== 'url'}
                editable={!saving}
                accessibilityLabel={label}
            />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={cancel} style={styles.headerButton} accessibilityRole="button">
                        <Text style={[styles.headerButtonText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>
                    <TouchableOpacity
                        onPress={save}
                        disabled={!dirty || !!error || busy || profile.loading}
                        style={[
                            styles.saveButton,
                            { backgroundColor: !dirty || error || busy || profile.loading ? theme.buttonInactive : theme.button },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Save profile"
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={theme.buttonText} />
                        ) : (
                            <Text style={[styles.saveText, { color: theme.buttonText }]}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {profile.loading ? (
                    <ActivityIndicator style={styles.status} color={theme.icon} />
                ) : profile.loadError ? (
                    <TouchableOpacity onPress={profile.reload} style={styles.status} accessibilityRole="button">
                        <Text style={[styles.message, { color: theme.textSecondary }]}>
                            {profile.loadError} <Text style={{ color: theme.button, fontWeight: '600' }}>Retry</Text>
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        {/* Cover with the avatar overlapping it, like a profile page. */}
                        <TouchableOpacity
                            onPress={() => changeImage('cover_image')}
                            disabled={busy}
                            style={[styles.cover, { backgroundColor: theme.bubble }]}
                            accessibilityRole="button"
                            accessibilityLabel="Change cover image"
                        >
                            {fields.cover_image ? (
                                <ExpoImage source={{ uri: fields.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                            ) : null}
                            <View style={styles.imageBadge}>
                                {uploading === 'cover_image' ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <FontAwesome name="camera" size={13} color="#fff" />
                                        <Text style={styles.imageBadgeText}>Cover</Text>
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => changeImage('profile_image')}
                            disabled={busy}
                            style={[styles.avatarWrap, { borderColor: theme.background, backgroundColor: theme.bubble }]}
                            accessibilityRole="button"
                            accessibilityLabel="Change profile photo"
                        >
                            {fields.profile_image ? (
                                <ExpoImage source={{ uri: fields.profile_image }} style={styles.avatar} contentFit="cover" />
                            ) : (
                                <FontAwesome name="user" size={40} color={theme.icon} />
                            )}
                            <View style={[styles.avatarBadge, { backgroundColor: theme.button }]}>
                                {uploading === 'profile_image' ? (
                                    <ActivityIndicator size="small" color={theme.buttonText} />
                                ) : (
                                    <FontAwesome name="camera" size={12} color={theme.buttonText} />
                                )}
                            </View>
                        </TouchableOpacity>

                        {field('name', 'Display name', { placeholder: 'Your name', max: PROFILE_LIMITS.name, autoCapitalize: 'words' })}
                        {field('about', 'About', { placeholder: 'A few words about you', max: PROFILE_LIMITS.about, multiline: true })}
                        {field('location', 'Location', { placeholder: 'Where you are', max: PROFILE_LIMITS.location, autoCapitalize: 'words' })}
                        {field('website', 'Website', {
                            placeholder: 'example.com',
                            max: PROFILE_LIMITS.website,
                            keyboardType: 'url',
                            autoCapitalize: 'none',
                        })}

                        {error ? <Text style={[styles.message, { color: theme.error }]}>{error}</Text> : null}
                        <Text style={[styles.hint, { color: theme.textSecondary }]}>
                            Your profile is stored on Hive, so it shows in every Hive app. Saving uses your posting key.
                        </Text>
                    </ScrollView>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default EditProfileScreen;

export const options = { headerShown: false };

const AVATAR = 96;

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
    saveButton: { minWidth: 64, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, alignItems: 'center' },
    saveText: { fontSize: 15, fontWeight: '700' },
    status: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
    message: { fontSize: 14, textAlign: 'center', marginVertical: 8 },
    content: { padding: 16, paddingBottom: 40 },
    cover: { height: 120, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 8 },
    imageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minHeight: 26,
    },
    imageBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    avatarWrap: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
        borderWidth: 4,
        marginTop: -AVATAR / 2,
        marginLeft: 16,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: { width: AVATAR - 8, height: AVATAR - 8, borderRadius: (AVATAR - 8) / 2 },
    avatarBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    field: { marginBottom: 14 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontSize: 14, fontWeight: '600' },
    counter: { fontSize: 12 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    multiline: { minHeight: 90 },
    hint: { fontSize: 12, marginTop: 4 },
});
