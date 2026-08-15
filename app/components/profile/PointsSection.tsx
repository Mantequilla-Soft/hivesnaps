import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { usePointsSummary } from '../../../hooks/usePointsSummary';
import { isPointsEnabled } from '../../../utils/pointsConfig';

interface PointsSectionProps {
    isOwnProfile: boolean;
    /** Whose points to display — the profile currently being viewed. */
    profileUsername: string | null | undefined;
    /** Logged-in viewer — used only for the feature-flag gate, not to pick whose stats show. */
    viewerUsername: string | null | undefined;
    colors: {
        text: string;
        textSecondary: string;
        bubble: string;
        border: string;
        icon: string;
        button: string;
        buttonText: string;
    };
}

export const PointsSection: React.FC<PointsSectionProps> = ({ isOwnProfile, profileUsername, viewerUsername, colors }) => {
    const router = useRouter();
    const enabled = isPointsEnabled(viewerUsername);
    const { summary, loading } = usePointsSummary(enabled ? profileUsername : null);

    if (!enabled) return null;
    if (!loading && !summary) return null;

    return (
        <View style={[localStyles.container, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
            <View style={localStyles.headerRow}>
                <FontAwesome name="star" size={13} color={colors.textSecondary} />
                <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>SNAPIE POINTS</Text>
            </View>

            {/* Balance is a spendable amount — only meaningful/shown on the account owner's own view. */}
            {isOwnProfile && (
                <View style={localStyles.balanceRow}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>Balance</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>{summary?.balance ?? '–'}</Text>
                </View>
            )}
            <View style={localStyles.balanceRow}>
                <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>Lifetime Earned</Text>
                <Text style={[localStyles.balanceValue, { color: colors.text }]}>{summary?.lifetimeEarned ?? '–'}</Text>
            </View>
            {summary?.rank != null && (
                <View style={localStyles.balanceRow}>
                    <Text style={[localStyles.balanceLabel, { color: colors.textSecondary }]}>Rank</Text>
                    <Text style={[localStyles.balanceValue, { color: colors.text }]}>#{summary.rank}</Text>
                </View>
            )}

            <TouchableOpacity
                style={[localStyles.leaderboardButton, { backgroundColor: colors.button }]}
                onPress={() => router.push('/screens/PointsLeaderboardScreen' as Href)}
                accessibilityRole="button"
                accessibilityLabel="View points leaderboard"
            >
                <Text style={[localStyles.leaderboardButtonText, { color: colors.buttonText }]}>Leaderboard</Text>
                <FontAwesome name="chevron-right" size={11} color={colors.buttonText} />
            </TouchableOpacity>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.8,
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    balanceLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    balanceValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    leaderboardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 12,
    },
    leaderboardButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
