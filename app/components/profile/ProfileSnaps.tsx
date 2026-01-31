import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Snap from '../Snap';
import { SnapData } from '../../../hooks/useConversationData';
import { createProfileScreenStyles } from '../../../styles/ProfileScreenStyles';

interface ColorScheme {
    text: string;
    button: string;
    buttonText: string;
    buttonInactive: string;
    icon: string;
}

interface UserSnap {
    author: string;
    permlink: string;
    body: string;
    [key: string]: unknown;
}

interface ProfileSnapsProps {
    snapsLoaded: boolean;
    snapsLoading: boolean;
    snapsError: string | null;
    userSnaps: UserSnap[];
    displayedSnapsCount: number;
    loadMoreLoading: boolean;
    currentUsername: string | null;
    colors: ColorScheme;
    styles: ReturnType<typeof createProfileScreenStyles>;
    fetchUserSnaps: () => void;
    loadMoreSnaps: () => void;
    convertUserSnapToSnapProps: (userSnap: UserSnap, currentUsername: string | null) => SnapData;
    openUpvoteModal: (params: { author: string; permlink: string; snap: SnapData }) => void;
    handleSnapReply: (snap: UserSnap) => void;
    handleSnapPress: (snap: UserSnap) => void;
    handleEditPress: (snapData: { author: string; permlink: string; body: string }) => void;
    onResnapPress: (author: string, permlink: string) => void;
}

export const ProfileSnaps: React.FC<ProfileSnapsProps> = ({
    snapsLoaded,
    snapsLoading,
    snapsError,
    userSnaps,
    displayedSnapsCount,
    loadMoreLoading,
    currentUsername,
    colors,
    styles,
    fetchUserSnaps,
    loadMoreSnaps,
    convertUserSnapToSnapProps,
    openUpvoteModal,
    handleSnapReply,
    handleSnapPress,
    handleEditPress,
    onResnapPress,
}) => {
    return (
        <View style={styles.snapsSection}>
            <Text style={[styles.snapsSectionTitle, { color: colors.text }]}>
                Recent Snaps
            </Text>

            {!snapsLoaded ? (
                <TouchableOpacity
                    style={[
                        styles.loadSnapsButton,
                        { backgroundColor: colors.button },
                    ]}
                    onPress={fetchUserSnaps}
                    disabled={snapsLoading}
                    activeOpacity={0.8}
                >
                    {snapsLoading ? (
                        <>
                            <FontAwesome
                                name='hourglass-half'
                                size={16}
                                color={colors.buttonText}
                            />
                            <Text
                                style={[
                                    styles.loadSnapsButtonText,
                                    { color: colors.buttonText },
                                ]}
                            >
                                Loading...
                            </Text>
                        </>
                    ) : (
                        <>
                            <FontAwesome
                                name='comment'
                                size={16}
                                color={colors.buttonText}
                            />
                            <Text
                                style={[
                                    styles.loadSnapsButtonText,
                                    { color: colors.buttonText },
                                ]}
                            >
                                Show Recent Snaps
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <>
                    <View style={styles.snapsSectionHeader}>
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={fetchUserSnaps}
                            disabled={snapsLoading}
                        >
                            <FontAwesome
                                name='refresh'
                                size={16}
                                color={colors.icon}
                            />
                        </TouchableOpacity>
                    </View>

                    {snapsError ? (
                        <View style={styles.snapsErrorContainer}>
                            <FontAwesome
                                name='exclamation-triangle'
                                size={24}
                                color='#E74C3C'
                            />
                            <Text
                                style={[styles.snapsErrorText, { color: colors.text }]}
                            >
                                {snapsError}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.retryButton,
                                    { backgroundColor: colors.button },
                                ]}
                                onPress={fetchUserSnaps}
                                disabled={snapsLoading}
                            >
                                <Text
                                    style={[
                                        styles.retryButtonText,
                                        { color: colors.buttonText },
                                    ]}
                                >
                                    Try Again
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : userSnaps.length === 0 ? (
                        <View style={styles.snapsEmptyContainer}>
                            <FontAwesome
                                name='comment-o'
                                size={32}
                                color={colors.buttonInactive}
                            />
                            <Text
                                style={[styles.snapsEmptyText, { color: colors.text }]}
                            >
                                No recent snaps found
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.verticalFeedContainer}>
                            {/* Display snaps using the existing Snap component */}
                            {userSnaps
                                .slice(0, displayedSnapsCount)
                                .map((userSnap, index) => {
                                    const snapProps = convertUserSnapToSnapProps(
                                        userSnap,
                                        currentUsername
                                    );

                                    return (
                                        <Snap
                                            key={`${userSnap.author}-${userSnap.permlink}`}
                                            snap={snapProps}
                                            onUpvotePress={snap =>
                                                openUpvoteModal({
                                                    author: snap.author,
                                                    permlink: snap.permlink,
                                                    snap: snapProps,
                                                })
                                            }
                                            onSpeechBubblePress={() =>
                                                handleSnapReply(userSnap)
                                            }
                                            onContentPress={() => handleSnapPress(userSnap)}
                                            showAuthor={true}
                                            onEditPress={handleEditPress}
                                            onResnapPress={(author, permlink) =>
                                                onResnapPress(author, permlink)
                                            }
                                            currentUsername={currentUsername}
                                        />
                                    );
                                })}

                            {/* Load More Button */}
                            {displayedSnapsCount < userSnaps.length && (
                                <TouchableOpacity
                                    style={[
                                        styles.loadMoreButton,
                                        { backgroundColor: colors.buttonInactive },
                                    ]}
                                    onPress={loadMoreSnaps}
                                    disabled={loadMoreLoading}
                                    activeOpacity={0.8}
                                >
                                    {loadMoreLoading ? (
                                        <>
                                            <FontAwesome
                                                name='hourglass-half'
                                                size={16}
                                                color={colors.text}
                                            />
                                            <Text
                                                style={[
                                                    styles.loadMoreButtonText,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                Loading...
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesome
                                                name='chevron-down'
                                                size={16}
                                                color={colors.text}
                                            />
                                            <Text
                                                style={[
                                                    styles.loadMoreButtonText,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                Load More (
                                                {userSnaps.length - displayedSnapsCount}{' '}
                                                remaining)
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </>
            )}
        </View>
    );
};
