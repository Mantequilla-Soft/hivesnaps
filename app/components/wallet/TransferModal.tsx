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
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { getClient } from '../../../services/HiveClient';
import { useAvatar } from '../../../hooks/useAvatar';

const client = getClient();

type UsernameLookupStatus = 'idle' | 'checking' | 'found' | 'not-found';

// User asked for "1, maybe 2 seconds" so they're clearly done typing before
// this spends a network call — same debounce snapie-io's WalletModal uses.
const USERNAME_LOOKUP_DEBOUNCE_MS = 1000;

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
        error?: string;
    };
    /** Pre-filled values from a scanned payment-request QR. */
    initialTo?: string;
    initialAmount?: string;
    initialMemo?: string;
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
    initialTo,
    initialAmount,
    initialMemo,
    onClose,
    onTransfer,
}) => {
    const [to, setTo] = useState(initialTo ?? '');
    const [amount, setAmount] = useState(initialAmount ?? '');
    const [memo, setMemo] = useState(initialMemo ?? '');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [usernameLookupStatus, setUsernameLookupStatus] = useState<UsernameLookupStatus>('idle');

    useEffect(() => {
        if (visible) {
            // Picks up any new initial values from a fresh QR scan each time
            // the modal (re)opens, rather than only on first mount.
            setTo(initialTo ?? '');
            setAmount(initialAmount ?? '');
            setMemo(initialMemo ?? '');
            setActiveKeyInput('');
            setError('');
            setUsernameLookupStatus('idle');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // Debounced real-time lookup — confirms the typed recipient is a real
    // Hive account and shows their avatar, so a mistyped recipient is
    // obvious before hitting Send rather than after (mirrors snapie-io's
    // WalletModal).
    useEffect(() => {
        const trimmed = to.trim().replace(/^@/, '').toLowerCase();
        if (!trimmed) {
            setUsernameLookupStatus('idle');
            return;
        }
        // Hive account names are capped at 16 chars — the RPC node throws
        // for anything longer, which isn't a network hiccup, it's a
        // definite "not a real account."
        if (trimmed.length > 16) {
            setUsernameLookupStatus('not-found');
            return;
        }
        setUsernameLookupStatus('checking');
        const timeoutId = setTimeout(async () => {
            try {
                const accounts = await client.database.getAccounts([trimmed]);
                setUsernameLookupStatus(accounts.length > 0 ? 'found' : 'not-found');
            } catch {
                // Network hiccup — don't block sending on a failed check,
                // just drop back to no verdict shown.
                setUsernameLookupStatus('idle');
            }
        }, USERNAME_LOOKUP_DEBOUNCE_MS);
        return () => clearTimeout(timeoutId);
    }, [to]);

    const recipientTrimmed = to.trim().replace(/^@/, '').toLowerCase();
    const { avatarUrl: recipientAvatarUrl } = useAvatar(
        usernameLookupStatus === 'found' ? recipientTrimmed : null
    );

    const amountNum = parseFloat(amount);
    const hasValidPrecision = !amount.includes('.') || (amount.split('.')[1] ?? '').length <= 3;
    const isValid =
        to.trim().length > 0 &&
        usernameLookupStatus !== 'not-found' &&
        !isNaN(amountNum) &&
        amountNum > 0 &&
        amountNum <= balance &&
        hasValidPrecision &&
        (hasStoredKey || activeKeyInput.trim().length > 0);

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            const recipient = to.trim().replace(/^@/, '').toLowerCase();
            await onTransfer(recipient, amount, memo.trim(), hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transfer failed');
        }
    };

    const setMax = (): void => setAmount(balance.toFixed(3));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
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
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                                    <View style={styles.recipientRow}>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                styles.recipientInput,
                                                {
                                                    color: colors.text,
                                                    borderColor: usernameLookupStatus === 'not-found' ? (colors.error ?? '#E74C3C') : colors.inputBorder,
                                                    backgroundColor: colors.bubble,
                                                },
                                            ]}
                                            placeholder="@username"
                                            placeholderTextColor={colors.textSecondary}
                                            value={to}
                                            onChangeText={setTo}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!loading}
                                        />
                                        {usernameLookupStatus === 'checking' && (
                                            <ActivityIndicator size="small" color={colors.icon} />
                                        )}
                                        {usernameLookupStatus === 'found' && (
                                            <ExpoImage source={{ uri: recipientAvatarUrl }} style={styles.recipientAvatar} />
                                        )}
                                    </View>
                                    {usernameLookupStatus === 'not-found' && (
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>
                                            No Hive account found with this username.
                                        </Text>
                                    )}
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
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>Amount exceeds available balance</Text>
                                    )}
                                    {!hasValidPrecision && (
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>Maximum 3 decimal places</Text>
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
                                        />
                                    </View>
                                )}

                                {error ? (
                                    <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>{error}</Text>
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
    recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    recipientInput: { flex: 1 },
    recipientAvatar: { width: 32, height: 32, borderRadius: 16 },
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
    errorText: { fontSize: 13, marginTop: 4 },
    buttons: { flexDirection: 'row', marginTop: 8 },
    button: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
    buttonText: { fontSize: 15, fontWeight: '600' },
});
