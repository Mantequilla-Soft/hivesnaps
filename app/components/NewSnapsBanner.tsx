import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { useAppColors } from '../styles/colors';
import { avatarService, getAvatarImageUrl } from '../../services/AvatarService';

const MAX_AVATARS = 3;

interface NewSnapsBannerProps {
    /** Authors of the new snaps, newest first (duplicates are fine). */
    authors: string[];
    count: number;
    loading?: boolean;
    onPress: () => void;
}

const avatarFor = (author: string): string =>
    avatarService.getCachedAvatarUrl(author) || getAvatarImageUrl(author);

/** Floating "↑ N new snaps" pill over the top of the feed. */
const NewSnapsBanner: React.FC<NewSnapsBannerProps> = ({ authors, count, loading = false, onPress }) => {
    const colors = useAppColors();
    const faces = Array.from(new Set(authors)).slice(0, MAX_AVATARS);
    const label = `${count} new snap${count === 1 ? '' : 's'}`;

    return (
        <View pointerEvents="box-none" style={styles.wrap}>
            <Pressable
                onPress={onPress}
                disabled={loading}
                style={({ pressed }) => [styles.pill, { backgroundColor: colors.button, opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`${label}. Show them at the top of the feed.`}
                accessibilityState={{ busy: loading }}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={colors.buttonText} />
                ) : (
                    <FontAwesome name="arrow-up" size={13} color={colors.buttonText} />
                )}
                {faces.length > 0 && (
                    <View style={styles.faces}>
                        {faces.map((a, i) => (
                            <ExpoImage
                                key={a}
                                source={{ uri: avatarFor(a) }}
                                style={[
                                    styles.face,
                                    { borderColor: colors.button, marginLeft: i === 0 ? 0 : -8, zIndex: MAX_AVATARS - i },
                                ]}
                            />
                        ))}
                    </View>
                )}
                <Text style={[styles.text, { color: colors.buttonText }]}>{label}</Text>
            </Pressable>
        </View>
    );
};

export default NewSnapsBanner;

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    faces: { flexDirection: 'row' },
    face: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
    text: { fontSize: 14, fontWeight: '700' },
});
