import React from 'react';
import { Modal, View, Text, Image, Pressable, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface ActiveKeyModalProps {
    visible: boolean;
    currentAvatarUrl?: string;
    newAvatarImage: string | null;
    activeKeyInput: string;
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
    onBack: () => void;
    onUpdateAvatar: () => void;
    onActiveKeyChange: (text: string) => void;
}

/**
 * Modal for confirming avatar update with active key (Step 2: Sign Transaction)
 * Requires user to enter their active key to sign the blockchain transaction
 */
export const ActiveKeyModal: React.FC<ActiveKeyModalProps> = ({
    visible,
    currentAvatarUrl,
    newAvatarImage,
    activeKeyInput,
    avatarUpdateLoading,
    avatarUpdateSuccess,
    colors,
    onClose,
    onBack,
    onUpdateAvatar,
    onActiveKeyChange,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.overlay}>
                    <View style={[styles.content, { backgroundColor: colors.background }]}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Confirm Avatar Update
                        </Text>

                        {/* Security Notice */}
                        <View style={[styles.securityNotice, { backgroundColor: colors.bubble }]}>
                            <View style={styles.securityHeader}>
                                <FontAwesome name="shield" size={20} color={colors.icon} style={styles.shieldIcon} />
                                <Text style={[styles.securityTitle, { color: colors.text }]}>
                                    Security Notice
                                </Text>
                            </View>
                            <Text style={[styles.securityText, { color: colors.text }]}>
                                To change your avatar, your active key is needed. This will be used to sign the
                                transaction only. It will not be stored on this phone for security reasons.
                            </Text>
                        </View>

                        {/* Active Key Input */}
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                Enter your active key:
                            </Text>
                            <View
                                style={[
                                    styles.inputContainer,
                                    { borderColor: colors.buttonInactive, backgroundColor: colors.background },
                                ]}
                            >
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="5K... (your active private key)"
                                    placeholderTextColor={colors.buttonInactive}
                                    value={activeKeyInput}
                                    onChangeText={onActiveKeyChange}
                                    secureTextEntry={true}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!avatarUpdateLoading}
                                    multiline={true}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        {/* Preview of change */}
                        <View style={styles.preview}>
                            {/* Current Avatar */}
                            <View style={styles.previewColumn}>
                                <Text style={[styles.previewLabel, { color: colors.text }]}>Current</Text>
                                {currentAvatarUrl ? (
                                    <Image source={{ uri: currentAvatarUrl }} style={styles.previewAvatar} />
                                ) : (
                                    <View
                                        style={[
                                            styles.previewAvatar,
                                            styles.defaultAvatar,
                                            { backgroundColor: colors.bubble },
                                        ]}
                                    >
                                        <FontAwesome name="user" size={25} color={colors.icon} />
                                    </View>
                                )}
                            </View>

                            {/* Arrow */}
                            <FontAwesome name="arrow-right" size={16} color={colors.icon} style={styles.arrow} />

                            {/* New Avatar */}
                            <View style={styles.previewColumn}>
                                <Text style={[styles.previewLabel, { color: colors.text }]}>New</Text>
                                {newAvatarImage && (
                                    <Image source={{ uri: newAvatarImage }} style={styles.previewAvatar} />
                                )}
                            </View>
                        </View>

                        {/* Action Buttons or Loading/Success States */}
                        {avatarUpdateLoading ? (
                            <View style={styles.statusContainer}>
                                <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                                <Text style={[styles.statusText, { color: colors.text }]}>
                                    Signing transaction...
                                </Text>
                            </View>
                        ) : avatarUpdateSuccess ? (
                            <View style={styles.statusContainer}>
                                <FontAwesome name="check-circle" size={32} color={colors.button} />
                                <Text style={[styles.statusText, { color: colors.text }]}>
                                    Avatar updated successfully!
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.actionButtons}>
                                <Pressable
                                    style={[styles.actionButton, { backgroundColor: colors.buttonInactive }]}
                                    onPress={onBack}
                                    disabled={avatarUpdateLoading}
                                >
                                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Back</Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.actionButton,
                                        {
                                            backgroundColor: activeKeyInput.trim()
                                                ? colors.button
                                                : colors.buttonInactive,
                                            marginLeft: 8,
                                        },
                                    ]}
                                    onPress={onUpdateAvatar}
                                    disabled={!activeKeyInput.trim() || avatarUpdateLoading}
                                >
                                    <Text
                                        style={[
                                            styles.actionButtonText,
                                            { color: activeKeyInput.trim() ? colors.buttonText : colors.text },
                                        ]}
                                    >
                                        Sign Transaction
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    securityNotice: {
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
    },
    securityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    shieldIcon: {
        marginRight: 8,
    },
    securityTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    securityText: {
        fontSize: 14,
        lineHeight: 20,
    },
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 15,
        marginBottom: 8,
    },
    inputContainer: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    input: {
        fontSize: 16,
        minHeight: 40,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    preview: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    previewColumn: {
        alignItems: 'center',
        flex: 1,
    },
    previewLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    previewAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    defaultAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    arrow: {
        marginHorizontal: 12,
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    statusText: {
        marginTop: 8,
    },
    actionButtons: {
        flexDirection: 'row',
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
