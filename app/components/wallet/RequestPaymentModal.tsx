import React, { useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { FontAwesome } from '@expo/vector-icons';
import { encodeHiveTransferQR } from '../../../utils/hiveQr';
import { useIncomingPayment } from '../../../hooks/useIncomingPayment';

interface RequestPaymentModalProps {
    visible: boolean;
    username: string;
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
        success?: string;
    };
    onClose: () => void;
}

export const RequestPaymentModal: React.FC<RequestPaymentModalProps> = ({
    visible,
    username,
    colors,
    onClose,
}) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'HIVE' | 'HBD'>('HIVE');
    const [memo, setMemo] = useState('');

    const amountNum = parseFloat(amount);
    const expectedAmount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;
    const formattedAmount = expectedAmount !== null ? `${amountNum.toFixed(3)} ${currency}` : `0.000 ${currency}`;

    const qrValue = useMemo(
        () => encodeHiveTransferQR(username, formattedAmount, memo),
        [username, formattedAmount, memo]
    );

    const payment = useIncomingPayment({
        username,
        active: visible,
        expectedAmount,
        currency,
    });

    const handleShare = async (): Promise<void> => {
        try {
            await Share.share({
                message: `Send ${formattedAmount} to @${username}${memo ? ` — "${memo}"` : ''}\n${qrValue}`,
            });
        } catch {
            // User dismissed the share sheet — nothing to do.
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={[styles.content, { backgroundColor: colors.background }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Request Payment</Text>

                    {payment ? (
                        <View style={styles.statusContainer}>
                            <FontAwesome name="check-circle" size={40} color={colors.success ?? colors.button} />
                            <Text style={[styles.statusText, { color: colors.text }]}>Payment received!</Text>
                            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
                                {payment.amount} from @{payment.from}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {/* QR code */}
                            <View style={styles.qrWrap}>
                                <QRCode value={qrValue} size={196} />
                            </View>
                            <Text style={[styles.waitingText, { color: colors.button }]}>Waiting for payment…</Text>
                            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                                Anyone with a Hive wallet can scan this to send you {formattedAmount}
                            </Text>

                            {/* Amount + currency */}
                            <View style={styles.amountRow}>
                                <TextInput
                                    style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                                    placeholder="Amount (optional)"
                                    placeholderTextColor={colors.textSecondary}
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="decimal-pad"
                                />
                                <View style={styles.currencyToggle}>
                                    {(['HIVE', 'HBD'] as const).map(c => (
                                        <Pressable
                                            key={c}
                                            style={[
                                                styles.currencyOption,
                                                { backgroundColor: currency === c ? colors.button : colors.buttonInactive },
                                            ]}
                                            onPress={() => setCurrency(c)}
                                        >
                                            <Text style={[styles.currencyOptionText, { color: currency === c ? colors.buttonText : colors.text }]}>
                                                {c}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Memo */}
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble, marginBottom: 16 }]}
                                placeholder="Memo (optional)"
                                placeholderTextColor={colors.textSecondary}
                                value={memo}
                                onChangeText={setMemo}
                            />

                            <Pressable
                                style={[styles.shareButton, { borderColor: colors.button }]}
                                onPress={handleShare}
                            >
                                <FontAwesome name="share-alt" size={14} color={colors.button} />
                                <Text style={[styles.shareButtonText, { color: colors.button }]}>Share QR</Text>
                            </Pressable>
                        </ScrollView>
                    )}

                    <Pressable style={[styles.closeButton, { backgroundColor: colors.buttonInactive }]} onPress={onClose}>
                        <Text style={[styles.closeButtonText, { color: colors.text }]}>Close</Text>
                    </Pressable>
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
        gap: 8,
    },
    statusText: { fontSize: 16, fontWeight: '600' },
    statusSubtext: { fontSize: 14 },
    qrWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        alignSelf: 'center',
    },
    waitingText: { fontSize: 12, textAlign: 'center', marginBottom: 4 },
    helperText: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
    amountRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    amountInput: { flex: 1 },
    input: {
        height: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    currencyToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
    currencyOption: { paddingHorizontal: 14, justifyContent: 'center' },
    currencyOptionText: { fontSize: 13, fontWeight: '700' },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        marginBottom: 8,
    },
    shareButtonText: { fontSize: 14, fontWeight: '600' },
    closeButton: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
    closeButtonText: { fontSize: 15, fontWeight: '600' },
});
