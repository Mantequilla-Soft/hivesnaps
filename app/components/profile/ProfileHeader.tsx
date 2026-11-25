import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { createProfileScreenStyles } from '../../../styles/ProfileScreenStyles';
import { useMoodBadge } from '../../../hooks/useMoodBadge';
import { moodSpoken } from '../../../services/moodBadgeService';
import { MoodBadge } from '../common/MoodBadge';

interface ColorScheme {
    background: string;
    text: string;
    bubble: string;
    icon: string;
}

interface ProfileHeaderProps {
    username: string;
    avatarUrl?: string;
    coverUrl?: string;
    displayName?: string;
    isOwnProfile: boolean;
    colors: ColorScheme;
    styles: ReturnType<typeof createProfileScreenStyles>;
    onEditProfilePress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    username,
    avatarUrl,
    coverUrl,
    displayName,
    isOwnProfile,
    colors,
    styles,
    onEditProfilePress,
}) => {
    // Many old covers are dead links (expired Discord attachments etc.);
    // on a load error drop back to the plain banner instead of a broken box.
    const [coverFailed, setCoverFailed] = useState(false);
    useEffect(() => setCoverFailed(false), [coverUrl]);
    const showCover = !!coverUrl && /^https?:\/\//i.test(coverUrl) && !coverFailed;
    const moodBadge = useMoodBadge(username);

    return (
        <>
            {/* Cover banner; plain themed background when there's none */}
            <View style={[styles.coverBanner, { backgroundColor: colors.bubble }]}>
                {showCover && (
                    <ExpoImage
                        source={{ uri: coverUrl }}
                        style={styles.coverImage}
                        contentFit="cover"
                        transition={150}
                        onError={() => setCoverFailed(true)}
                        accessibilityIgnoresInvertColors
                    />
                )}
            </View>

            {/* Avatar, overlapping the bottom edge of the cover */}
            <View
                style={[
                    styles.avatarContainer,
                    styles.avatarOverCover,
                    { borderColor: colors.background, backgroundColor: colors.background },
                ]}
            >
                {avatarUrl ? (
                    <Image
                        source={{ uri: avatarUrl }}
                        style={styles.largeAvatar}
                    />
                ) : (
                    <View
                        style={[
                            styles.largeAvatar,
                            styles.defaultAvatar,
                            { backgroundColor: colors.bubble },
                        ]}
                    >
                        <FontAwesome name='user' size={60} color={colors.icon} />
                    </View>
                )}
                {moodBadge && <MoodBadge sku={moodBadge} size={34} ringColor={colors.background} offset={2} />}
            </View>

            {/* Username */}
            <Text
                style={[styles.username, { color: colors.text }]}
                accessibilityLabel={moodBadge ? `@${username}, ${moodSpoken(moodBadge)}` : undefined}
            >
                @{username}
            </Text>

            {/* Edit Profile Button (Only for own profile) */}
            {isOwnProfile && (
                <TouchableOpacity
                    style={styles.editAvatarButton}
                    onPress={onEditProfilePress}
                    accessibilityRole="button"
                >
                    <FontAwesome name='pencil' size={16} color={colors.icon} />
                    <Text style={[styles.editAvatarText, { color: colors.icon }]}>
                        Edit Profile
                    </Text>
                </TouchableOpacity>
            )}

            {/* Display Name */}
            {displayName && (
                <Text style={[styles.displayName, { color: colors.text }]}>
                    {displayName}
                </Text>
            )}
        </>
    );
};
