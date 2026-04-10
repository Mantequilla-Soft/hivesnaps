import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface TransferModalProps {
    visible: boolean;
    currency: 'HIVE' | 'HBD';
    balance: number;
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
    };
    onClose: () => void;
    onTransfer: (to: string, amount: string, memo: string, manualKey?: string) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
    visible,
    currency,
    balance,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onTransfer,
}) => {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!visible) {
            setTo('');
            setAmount('');
            setMemo('');
            setActiveKeyInput('');
            setError('');
        }
    }, [visible]);

    const amountNum = parseFloat(amount);
    const isValid =
        to.trim().length > 0 &&
        !isNaN(amountNum) &&
        amountNum > 0 &&
        amountNum <= balance &&
        (hasStoredKey || activeKeyInput.trim().length > 0);

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            await onTransfer(to.trim(), amount, memo.trim(), hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transfer failed');
        }
    };

    const setMax = (): void => setAmount(balance.toFixed(3));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.overlay}>
                    <View style={[styles.content, { backgroundColor: colors.background }]}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Transfer {currency}
                        </Text>

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
                                    Transfer sent!
                                </Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Available balance */}
                                <View style={[styles.balanceRow, { backgroundColor: colors.bubble }]}>
                                    <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                                        Available
                                    </Text>
                                    <Text style={[styles.balanceValue, { color: colors.text }]}>
                                        {balance.toFixed(3)} {currency}
                                    </Text>
                                </View>

                                {/* Recipient */}
                                <View style={styles.field}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>To</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                        placeholder="@username"
                                        placeholderTextColor={colors.textSecondary}
                                        value={to}
                                        onChangeText={setTo}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!loading}
                                    />
                                </View>

                                {/* Amount */}
                                <View style={styles.field}>
                                    <View style={styles.amountHeader}>
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Amount</Text>
                                        <Pressable onPress={setMax}>
                                            <Text style={[styles.maxButton, { color: colors.button }]}>MAX</Text>
                                        </Pressable>
                                    </View>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                        placeholder={`0.000 ${currency}`}
                                        placeholderTextColor={colors.textSecondary}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        editable={!loading}
                                    />
                                    {amountNum > balance && (
                                        <Text style={styles.errorText}>Amount exceeds available balance</Text>
                                    )}
                                </View>

                                {/* Memo */}
                                <View style={styles.field}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                                        Memo <Text style={{ color: colors.textSecondary }}>(optional)</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                        placeholder="Add a note..."
                                        placeholderTextColor={colors.textSecondary}
                                        value={memo}
                                        onChangeText={setMemo}
                                        editable={!loading}
                                    />
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
                                            multiline
                                            textAlignVertical="top"
                                        />
                                    </View>
                                )}

                                {error ? (
                                    <Text style={styles.errorText}>{error}</Text>
                                ) : null}

                                {/* Buttons */}
                                <View style={styles.buttons}>
                                    <Pressable
                                        style={[styles.button, { backgroundColor: colors.buttonInactive }]}
                                        onPress={onClose}
                                    >
                                        <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.button, { backgroundColor: isValid ? colors.button : colors.buttonInactive, marginLeft: 8 }]}
                                        onPress={handleConfirm}
                                        disabled={!isValid || loading}
                                    >
                                        <Text style={[styles.buttonText, { color: isValid ? colors.buttonText : colors.text }]}>
                                            Send
                                        </Text>
                                    </Pressable>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
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
        maxHeight: '85%',
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
    statusText: {
        fontSize: 16,
        fontWeight: '500',
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
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
    errorText: { color: '#E74C3C', fontSize: 13, marginTop: 4 },
    buttons: { flexDirection: 'row', marginTop: 8 },
    button: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
    buttonText: { fontSize: 15, fontWeight: '600' },
});
