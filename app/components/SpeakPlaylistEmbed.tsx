import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { speakPlaylistPageUrl } from '../../utils/speakAudio';
import { AUDIO_PLAYER_BORDER_RADIUS, AUDIO_PLAYER_MARGIN_VERTICAL } from '../constants/ui';

/** 3Speak's playlist player (track list + controls); snapie.io uses the same height. */
const PLAYLIST_PLAYER_HEIGHT = 480;

type State = 'loading' | 'audio' | 'no-audio';

/** Whether a 3Speak playlist has any audio tracks its player can play. */
export async function playlistHasAudio(listId: string): Promise<boolean> {
    try {
        const res = await fetch(`https://audio.3speak.tv/api/audio/playlist/${encodeURIComponent(listId)}`);
        if (!res.ok) return false;
        const data = (await res.json()) as { tracks?: unknown };
        return Array.isArray(data.tracks) && data.tracks.length > 0;
    } catch {
        return false;
    }
}

/**
 * 3Speak audio playlist (snapie.io's SpeakPlaylistEmbed). Its player only
 * plays audio tracks, so a playlist with none (missing, private, or videos
 * only) gets a card that opens the playlist on 3Speak instead of an empty
 * player.
 */
const SpeakPlaylistEmbed: React.FC<{ listId: string }> = ({ listId }) => {
    const theme = useTheme();
    const [state, setState] = useState<State>('loading');

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        playlistHasAudio(listId).then((has) => {
            if (!cancelled) setState(has ? 'audio' : 'no-audio');
        });
        return () => {
            cancelled = true;
        };
    }, [listId]);

    if (state === 'loading') {
        return (
            <View style={[styles.placeholder, { backgroundColor: theme.bubble }]}>
                <ActivityIndicator size="small" color={theme.icon} />
            </View>
        );
    }

    if (state === 'no-audio') {
        return (
            <TouchableOpacity
                onPress={() => Linking.openURL(speakPlaylistPageUrl(listId))}
                style={[styles.linkCard, { borderColor: theme.border, backgroundColor: theme.bubble }]}
                accessibilityRole="link"
                accessibilityLabel="Open playlist on 3Speak"
            >
                <FontAwesome name="list-ul" size={18} color={theme.button} />
                <Text style={[styles.linkText, { color: theme.text }]}>Open playlist on 3Speak</Text>
                <FontAwesome name="external-link" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.player}>
            <WebView
                source={{ uri: `https://audio.3speak.tv/play?list=${encodeURIComponent(listId)}&iframe=1` }}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction
                nestedScrollEnabled
            />
        </View>
    );
};

export default SpeakPlaylistEmbed;

const styles = StyleSheet.create({
    placeholder: {
        height: 80,
        marginVertical: AUDIO_PLAYER_MARGIN_VERTICAL,
        borderRadius: AUDIO_PLAYER_BORDER_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: AUDIO_PLAYER_MARGIN_VERTICAL,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: AUDIO_PLAYER_BORDER_RADIUS,
        borderWidth: 1,
    },
    linkText: { flex: 1, fontSize: 15, fontWeight: '600' },
    player: {
        height: PLAYLIST_PLAYER_HEIGHT,
        marginVertical: AUDIO_PLAYER_MARGIN_VERTICAL,
        borderRadius: AUDIO_PLAYER_BORDER_RADIUS,
        overflow: 'hidden',
    },
    webview: { flex: 1, backgroundColor: 'transparent' },
});
