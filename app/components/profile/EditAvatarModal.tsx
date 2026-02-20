import React from 'react';
import { Modal, View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface EditAvatarModalProps {
    visible: boolean;
    currentAvatarUrl?: string;
    newAvatarImage: string | null;
    avatarUploading: boolean;
    avatarUpdateLoading: boolean;
    avatarUpdateSuccess: boolean;
    colors: {
        background: string;
        text: string;
        bubble: string;
        icon: string;
        button: string;
        buttonText: string;
        buttonInactive: string;
    };
    onClose: () => void;
    onSelectNewAvatar: () => void;
    onNextStep: () => void;
}

/**
 * Modal for editing profile avatar image (Step 1: Select Image)
 * Displays current avatar, allows selecting a new image, and proceeds to confirmation step
 */
export const EditAvatarModal: React.FC<EditAvatarModalProps> = ({
    visible,
    currentAvatarUrl,
    newAvatarImage,
    avatarUploading,
    avatarUpdateLoading,
    avatarUpdateSuccess,
    colors,
    onClose,
    onSelectNewAvatar,
    onNextStep,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        Update Profile Image
                    </Text>

                    {/* Current vs New Avatar Preview */}
                    <View style={styles.avatarComparison}>
                        {/* Current Avatar */}
                        <View style={styles.avatarColumn}>
                            <Text style={[styles.label, { color: colors.text }]}>Current</Text>
                            {currentAvatarUrl ? (
                                <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: colors.bubble }]}>
                                    <FontAwesome name="user" size={40} color={colors.icon} />
                                </View>
                            )}
                        </View>

                        {/* Arrow */}
                        <FontAwesome
                            name="arrow-right"
                            size={20}
                            color={colors.icon}
                            style={styles.arrow}
                        />

                        {/* New Avatar */}
                        <View style={styles.avatarColumn}>
                            <Text style={[styles.label, { color: colors.text }]}>New</Text>
                            {newAvatarImage ? (
                                <Image source={{ uri: newAvatarImage }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: colors.buttonInactive }]}>
                                    <FontAwesome name="camera" size={30} color={colors.icon} />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Select Image Button */}
                    {!newAvatarImage && (
                        <Pressable
                            style={[styles.selectButton, { backgroundColor: colors.buttonInactive }]}
                            onPress={onSelectNewAvatar}
                            disabled={avatarUploading || avatarUpdateLoading}
                        >
                            <FontAwesome name="image" size={20} color={colors.icon} style={styles.buttonIcon} />
                            <Text style={[styles.selectButtonText, { color: colors.text }]}>
                                {avatarUploading ? 'Uploading...' : 'Select New Image'}
                            </Text>
                            {avatarUploading && (
                                <ActivityIndicator size="small" color={colors.icon} style={styles.loader} />
                            )}
                        </Pressable>
                    )}

                    {/* Change Image Button (if image already selected) */}
                    {newAvatarImage && !avatarUpdateLoading && !avatarUpdateSuccess && (
                        <Pressable
                            style={[styles.changeButton, { backgroundColor: colors.buttonInactive }]}
                            onPress={onSelectNewAvatar}
                            disabled={avatarUploading}
                        >
                            <FontAwesome name="refresh" size={16} color={colors.icon} style={styles.buttonIcon} />
                            <Text style={[styles.changeButtonText, { color: colors.text }]}>
                                Change Image
                            </Text>
                        </Pressable>
                    )}

                    {/* Action Buttons or Loading/Success States */}
                    {avatarUpdateLoading ? (
                        <View style={styles.statusContainer}>
                            <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                            <Text style={[styles.statusText, { color: colors.text }]}>
                                Updating profile...
                            </Text>
                        </View>
                    ) : avatarUpdateSuccess ? (
                        <View style={styles.statusContainer}>
                            <FontAwesome name="check-circle" size={32} color={colors.button} />
                            <Text style={[styles.statusText, { color: colors.text }]}>
                                Profile updated!
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.actionButtons}>
                            <Pressable
                                style={[styles.actionButton, { backgroundColor: colors.buttonInactive }]}
                                onPress={onClose}
                                disabled={avatarUploading}
                            >
                                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                                    Cancel
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.actionButton,
                                    {
                                        backgroundColor: newAvatarImage ? colors.button : colors.buttonInactive,
                                        marginLeft: 8,
                                    },
                                ]}
                                onPress={onNextStep}
                                disabled={!newAvatarImage || avatarUpdateLoading || avatarUploading}
                            >
                                <Text
                                    style={[
                                        styles.actionButtonText,
                                        { color: newAvatarImage ? colors.buttonText : colors.text },
                                    ]}
                                >
                                    Next
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        borderRadius: 16,
        padding: 24,
        width: '90%',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    avatarComparison: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarColumn: {
        alignItems: 'center',
        flex: 1,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    defaultAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    arrow: {
        marginHorizontal: 16,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    selectButtonText: {
        fontWeight: '600',
    },
    buttonIcon: {
        marginRight: 8,
    },
    loader: {
        marginLeft: 8,
    },
    changeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    changeButtonText: {
        fontWeight: '500',
        fontSize: 14,
    },
    statusContainer: {
        marginTop: 8,
        alignItems: 'center',
    },
    statusText: {
        marginTop: 8,
    },
    actionButtons: {
        flexDirection: 'row',
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    actionButtonText: {
        fontWeight: '600',
    },
});
