import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { BlogCard } from '../BlogCard';
import { useAccountReblogs } from '../../../hooks/useAccountReblogs';
import { hasUserVoted } from '../../../utils/votes';

interface ProfileReblogsProps {
    username: string;
    currentUsername: string | null;
    colors: { text: string; textSecondary?: string; button: string; buttonText: string; icon: string };
    onOpenPost: (author: string, permlink: string) => void;
    onAuthorPress: (username: string) => void;
}

/** Posts this account has reblogged; loads when first shown. */
export const ProfileReblogs: React.FC<ProfileReblogsProps> = ({
    username,
    currentUsername,
    colors,
    onOpenPost,
    onAuthorPress,
}) => {
    const { reblogs, loading, hasMore, error, loadMore, refresh } = useAccountReblogs(username);
    const secondary = colors.textSecondary ?? colors.icon;

    // First page when the tab is opened (or the profile changes).
    useEffect(() => {
        if (reblogs.length === 0 && hasMore && !loading && !error) loadMore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    return (
        <View>
            {reblogs.map((post) => (
                <BlogCard
                    key={`${post.author}/${post.permlink}`}
                    post={post}
                    hasUpvoted={hasUserVoted(post.active_votes, currentUsername)}
                    onPress={() => onOpenPost(post.author, post.permlink)}
                    onAuthorPress={onAuthorPress}
                />
            ))}

            {loading ? (
                <ActivityIndicator style={styles.status} color={colors.icon} />
            ) : error ? (
                <TouchableOpacity onPress={reblogs.length ? loadMore : refresh} style={styles.status} accessibilityRole="button">
                    <Text style={[styles.message, { color: secondary }]}>
                        {error} <Text style={{ color: colors.button, fontWeight: '600' }}>Retry</Text>
                    </Text>
                </TouchableOpacity>
            ) : reblogs.length === 0 && !hasMore ? (
                <View style={styles.status}>
                    <FontAwesome name="share-square-o" size={22} color={secondary} />
                    <Text style={[styles.message, { color: secondary }]}>No reblogs yet.</Text>
                </View>
            ) : hasMore ? (
                <TouchableOpacity
                    onPress={loadMore}
                    style={[styles.more, { backgroundColor: colors.button }]}
                    accessibilityRole="button"
                >
                    <Text style={[styles.moreText, { color: colors.buttonText }]}>
                        {reblogs.length === 0 ? 'Look further back' : 'Load more'}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    status: { alignItems: 'center', paddingVertical: 20, gap: 8 },
    message: { fontSize: 14, textAlign: 'center' },
    more: { alignSelf: 'center', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, marginVertical: 12 },
    moreText: { fontSize: 14, fontWeight: '600' },
});
