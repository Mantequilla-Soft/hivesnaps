import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { vestsToHp } from '../../../utils/hiveCalculations';

interface PowerUpModalProps {
    visible: boolean;
    hiveBalance: number;
    globalProps: { total_vesting_fund_hive: string; total_vesting_shares: string } | null;
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
    onPowerUp: (amount: string, manualKey?: string) => Promise<void>;
}

export const PowerUpModal: React.FC<PowerUpModalProps> = ({
    visible,
    hiveBalance,
    globalProps,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onPowerUp,
}) => {
    const [amount, setAmount] = useState('');
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!visible) {
            setAmount('');
            setActiveKeyInput('');
            setError('');
        }
    }, [visible]);

    const amountNum = parseFloat(amount);
    const hasValidPrecision = !amount.includes('.') || (amount.split('.')[1] ?? '').length <= 3;
    const isValid =
        !isNaN(amountNum) &&
        amountNum > 0 &&
        amountNum <= hiveBalance &&
        hasValidPrecision &&
        (hasStoredKey || activeKeyInput.trim().length > 0);

    // Preview: how much HP would this be
    const previewHp = globalProps && !isNaN(amountNum) && amountNum > 0
        ? vestsToHp(
            amountNum / (parseFloat(globalProps.total_vesting_fund_hive) / parseFloat(globalProps.total_vesting_shares.replace(' VESTS', '').replace(' HIVE', ''))),
            globalProps.total_vesting_fund_hive,
            globalProps.total_vesting_shares
          )
        : null;

    // Simpler preview: 1 HIVE ≈ 1 HP (practically true, very slight variation)
    // Use direct amount as HP preview since HIVE:HP ratio is ~1:1
    const hpPreview = !isNaN(amountNum) && amountNum > 0 ? amountNum : null;

    const handleConfirm = async (): Promise<void> => {
        setError('');
        try {
            await onPowerUp(amount, hasStoredKey ? undefined : activeKeyInput.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Power up failed');
        }
    };

    const setMax = (): void => setAmount(hiveBalance.toFixed(3));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                    <View style={[styles.content, { backgroundColor: colors.background }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Power Up</Text>

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
                                    Powered up!
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Info box */}
                                <View style={[styles.infoBox, { backgroundColor: colors.infoBoxBackground }]}>
                                    <FontAwesome name="info-circle" size={14} color={colors.icon} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                        Convert liquid HIVE to Hive Power. HP earns curation rewards and increases your voting influence.
                                    </Text>
                                </View>

                                {/* Available balance */}
                                <View style={[styles.balanceRow, { backgroundColor: colors.bubble }]}>
                                    <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Available HIVE</Text>
                                    <Text style={[styles.balanceValue, { color: colors.text }]}>
                                        {hiveBalance.toFixed(3)} HIVE
                                    </Text>
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
                                        placeholder="0.000 HIVE"
                                        placeholderTextColor={colors.textSecondary}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        editable={!loading}
                                    />
                                    {hpPreview !== null && (
                                        <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                                            ≈ {hpPreview.toFixed(3)} HP
                                        </Text>
                                    )}
                                    {amountNum > hiveBalance && (
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>Amount exceeds available balance</Text>
                                    )}
                                    {!hasValidPrecision && (
                                        <Text style={[styles.errorText, { color: colors.error ?? '#E74C3C' }]}>Maximum 3 decimal places</Text>
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
                                        onPress={handleConfirm}
                                        disabled={!isValid || loading}
                                    >
                                        <Text style={[styles.buttonText, { color: isValid ? colors.buttonText : colors.text }]}>
                                            Power Up
                                        </Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>
                </View>
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
    infoBox: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        alignItems: 'flex-start',
    },
    infoText: { fontSize: 13, lineHeight: 18, flex: 1 },
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
