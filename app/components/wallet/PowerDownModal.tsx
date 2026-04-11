import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface PowerDownModalProps {
    visible: boolean;
    /** Effective HP available to power down (own HP only, excl. delegations received) */
    ownHivePower: number;
    /** Non-zero means a power down is currently active (weekly rate in HP) */
    activePowerDownRate: number;
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: {
        background: string;
        text: string;
        textSecondary: string;
        bubble: string;
        icon: string;
        button: string;
        buttonText: string;
        buttonInactive: string;
        inputBorder: string;
        infoBoxBackground: string;
        warningBoxBackground: string;
        error?: string;
    };
    onClose: () => void;
    onPowerDown: (amountHp: string, manualKey?: string) => Promise<void>;
    onCancelPowerDown: (manualKey?: string) => Promise<void>;
}

export const PowerDownModal: React.FC<PowerDownModalProps> = ({
    visible,
    ownHivePower,
    activePowerDownRate,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onPowerDown,
    onCancelPowerDown,
}) => {
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [lastAction, setLastAction] = useState<'start' | 'cancel'>('start');

    useEffect(() => {
        if (!visible) {
            setAmount('');
            setActiveKeyInput('');
            setError('');
            setLastAction('start');
        }
    }, [visible]);

    const amountNum = parseFloat(amount);
    const weeklyPayout = !isNaN(amountNum) && amountNum > 0 ? amountNum / 13 : 0;
    const isPowerDownActive = activePowerDownRate > 0;
    const canAuthenticate = hasStoredKey || activeKeyInput.trim().length > 0;

    const isValid =
        !isNaN(amountNum) &&
        amountNum > 0 &&
        amountNum <= ownHivePower &&
        canAuthenticate;

    const handlePowerDown = async (): Promise<void> => {
        setError('');
        setLastAction('start');
        try {
            await onPowerDown(amount, hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Power down failed');
        }
    };

    const handleCancel = async (): Promise<void> => {
        setError('');
        setLastAction('cancel');
        try {
            await onCancelPowerDown(hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel power down');
        }
    };

    const setMax = (): void => setAmount(ownHivePower.toFixed(3));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior="padding"
                enabled={Platform.OS === 'ios'}
            >
                    <View style={[styles.content, { backgroundColor: colors.background }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Power Down</Text>

                        {loading ? (
                            <View style={styles.statusContainer}>
                                <ActivityIndicator size="large" color={colors.icon} />
                                <Text style={[styles.statusText, { color: colors.text }]}>
                                    Broadcasting transaction...
                                </Text>
                            </View>
                        ) : success ? (
                            <View style={styles.statusContainer}>
                                <FontAwesome name="check-circle" size={40} color={colors.button} />
                                <Text style={[styles.statusText, { color: colors.text }]}>
                                    {lastAction === 'cancel' ? 'Power down cancelled!' : 'Power down started!'}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {/* Warning box */}
                                <View style={[styles.warningBox, { backgroundColor: colors.warningBoxBackground }]}>
                                    <FontAwesome name="warning" size={14} color={colors.icon} />
                                    <Text style={[styles.warningText, { color: colors.text }]}>
                                        Power down takes 13 weeks. HIVE is paid out weekly in equal installments.
                                    </Text>
                                </View>

                                {/* Active power down status */}
                                {isPowerDownActive && (
                                    <View style={[styles.activeStatus, { backgroundColor: colors.infoBoxBackground }]}>
                                        <View style={styles.activeStatusRow}>
                                            <FontAwesome name="refresh" size={13} color={colors.icon} />
                                            <Text style={[styles.activeStatusText, { color: colors.text }]}>
                                                Power down active — {activePowerDownRate.toFixed(3)} HP/week
                                            </Text>
                                        </View>
                                        <Pressable
                                            style={[styles.cancelPdButton, { borderColor: colors.buttonInactive }]}
                                            onPress={handleCancel}
                                            disabled={!canAuthenticate || loading}
                                        >
                                            <Text style={[styles.cancelPdText, { color: colors.text }]}>
                                                Cancel Power Down
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}

                                {/* Available HP */}
                                <View style={[styles.balanceRow, { backgroundColor: colors.bubble }]}>
                                    <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                                        Available HP
                                    </Text>
                                    <Text style={[styles.balanceValue, { color: colors.text }]}>
                                        {ownHivePower.toFixed(3)} HP
                                    </Text>
                                </View>

                                {/* Amount */}
                                <View style={styles.field}>
                                    <View style={styles.amountHeader}>
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Total Amount to Power Down</Text>
                                        <Pressable onPress={setMax}>
                                            <Text style={[styles.maxButton, { color: colors.button }]}>MAX</Text>
                                        </Pressable>
                                    </View>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                        placeholder="0.000 HP"
                                        placeholderTextColor={colors.textSecondary}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        editable={!loading}
                                    />
                                    {weeklyPayout > 0 && (
                                        <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                                            Weekly payout: {weeklyPayout.toFixed(3)} HIVE × 13 weeks
                                        </Text>
                                    )}
                                    {amountNum > ownHivePower && (
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>Amount exceeds available HP</Text>
                                    )}
                                </View>

                                {/* Active key section */}
                                {hasStoredKey ? (
                                    <View style={[styles.biometricNotice, { backgroundColor: colors.infoBoxBackground }]}>
                                        <FontAwesome name="lock" size={14} color={colors.icon} />
                                        <Text style={[styles.biometricText, { color: colors.textSecondary }]}>
                                            Secured by biometrics
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.field}>
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Active Key</Text>
                                        <TextInput
                                            style={[styles.keyInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                            placeholder="5K..."
                                            placeholderTextColor={colors.textSecondary}
                                            value={activeKeyInput}
                                            onChangeText={setActiveKeyInput}
                                            secureTextEntry
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!loading}
                                        />
                                    </View>
                                )}

                                {error ? <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>{error}</Text> : null}

                                <View style={styles.buttons}>
                                    <Pressable
                                        style={[styles.button, { backgroundColor: colors.buttonInactive }]}
                                        onPress={onClose}
                                    >
                                        <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.button, { backgroundColor: isValid ? colors.button : colors.buttonInactive, marginLeft: 8 }]}
                                        onPress={handlePowerDown}
                                        disabled={!isValid || loading}
                                    >
                                        <Text style={[styles.buttonText, { color: isValid ? colors.buttonText : colors.text }]}>
                                            {isPowerDownActive ? 'Update' : 'Start'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </ScrollView>
                        )}
                    </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        borderRadius: 16,
        padding: 24,
        width: '92%',
        maxWidth: 420,
        maxHeight: '88%',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    statusText: { fontSize: 16, fontWeight: '500' },
    warningBox: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        alignItems: 'flex-start',
    },
    warningText: { fontSize: 13, lineHeight: 18, flex: 1 },
    activeStatus: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        gap: 10,
    },
    activeStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activeStatusText: { fontSize: 13, fontWeight: '500' },
    cancelPdButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    cancelPdText: { fontSize: 13, fontWeight: '600' },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
    },
    balanceLabel: { fontSize: 13 },
    balanceValue: { fontSize: 14, fontWeight: '600' },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    maxButton: { fontSize: 12, fontWeight: '700' },
    input: {
        height: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    previewText: { fontSize: 12, marginTop: 4 },
    keyInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        minHeight: 44,
    },
    biometricNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 8,
        marginBottom: 14,
    },
    biometricText: { fontSize: 13 },
    errorText: { fontSize: 13, marginTop: 4 },
    buttons: { flexDirection: 'row', marginTop: 8 },
    button: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
    buttonText: { fontSize: 15, fontWeight: '600' },
});
