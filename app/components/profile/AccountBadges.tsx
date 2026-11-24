import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Linking, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { useAccountBadges } from '../../../hooks/useAccountBadges';
import { badgePageUrl, type AccountBadge } from '../../../services/badgesService';
import { proxyImageUrl } from '../../../utils/proxyImageUrl';

interface Props {
    username: string;
    colors: { text: string; textSecondary: string; background: string; border: string; button: string; buttonText: string };
}

const SIZE = 36;

/**
 * PeakD-style badge row (snapie.io's AccountBadges). A badge icon is
 * decorative, so one that fails to load is quietly dropped. Tap a badge for
 * its name and description, with a link to its PeakD page.
 */
export const AccountBadges: React.FC<Props> = ({ username, colors }) => {
    const badges = useAccountBadges(username);
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const [selected, setSelected] = useState<AccountBadge | null>(null);

    const visible = badges.filter((b) => !failed.has(b.account));
    if (visible.length === 0) return null;

    return (
        <View style={styles.row} accessibilityLabel={`${visible.length} badges`}>
            {visible.map((badge) => (
                <TouchableOpacity
                    key={badge.account}
                    onPress={() => setSelected(badge)}
                    style={[styles.badge, { borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={badge.name}
                >
                    <ExpoImage
                        source={{ uri: proxyImageUrl(badge.image) }}
                        style={styles.icon}
                        contentFit="cover"
                        onError={() => setFailed((prev) => new Set(prev).add(badge.account))}
                    />
                </TouchableOpacity>
            ))}

            <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
                <Pressable style={styles.backdrop} onPress={() => setSelected(null)} accessibilityLabel="Close">
                    {selected && (
                        <Pressable style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <ExpoImage source={{ uri: proxyImageUrl(selected.image) }} style={styles.cardIcon} contentFit="cover" />
                            <Text style={[styles.name, { color: colors.text }]}>{selected.name}</Text>
                            {selected.about ? (
                                <Text style={[styles.about, { color: colors.textSecondary }]}>{selected.about}</Text>
                            ) : null}
                            <TouchableOpacity
                                onPress={() => Linking.openURL(badgePageUrl(selected.account))}
                                style={[styles.link, { backgroundColor: colors.button }]}
                                accessibilityRole="link"
                            >
                                <Text style={[styles.linkText, { color: colors.buttonText }]}>View on PeakD</Text>
                                <FontAwesome name="external-link" size={12} color={colors.buttonText} />
                            </TouchableOpacity>
                        </Pressable>
                    )}
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 8, paddingHorizontal: 16 },
    badge: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, overflow: 'hidden' },
    icon: { width: '100%', height: '100%' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
    card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 20, alignItems: 'center' },
    cardIcon: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
    name: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
    about: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    linkText: { fontSize: 14, fontWeight: '700' },
});
