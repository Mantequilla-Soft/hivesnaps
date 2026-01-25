import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface ColorScheme {
    text: string;
    bubble: string;
    icon: string;
}

interface ProfileHeaderProps {
    username: string;
    avatarUrl?: string;
    displayName?: string;
    isOwnProfile: boolean;
    colors: ColorScheme;
    /** Styles object created by createProfileScreenStyles - typed as any due to dynamic creation */
    styles: any;
    onEditAvatarPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    username,
    avatarUrl,
    displayName,
    isOwnProfile,
    colors,
    styles,
    onEditAvatarPress,
}) => {
    return (
        <>
            {/* Username */}
            <Text style={[styles.username, { color: colors.text }]}>
                @{username}
            </Text>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
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
            </View>

            {/* Edit Profile Image Button (Only for own profile) */}
            {isOwnProfile && (
                <TouchableOpacity
                    style={styles.editAvatarButton}
                    onPress={onEditAvatarPress}
                >
                    <FontAwesome name='camera' size={16} color={colors.icon} />
                    <Text style={[styles.editAvatarText, { color: colors.icon }]}>
                        Edit Profile Image
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
