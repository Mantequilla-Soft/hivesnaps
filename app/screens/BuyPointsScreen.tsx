import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { useWalletOperations } from '../../hooks/useWalletOperations';
import { usePointsSummary } from '../../hooks/usePointsSummary';
import { AuthCancelledError } from '../../services/LocalAuthService';
import {
    recordPendingPurchase,
    getPendingPurchaseTxids,
    resumePendingPurchases,
    verifyPointsPurchase,
    PurchaseResult,
} from '../../services/pointsService';
import {
    POINTS_PER_HBD,
    MIN_PURCHASE_HBD,
    MAX_PURCHASE_HBD,
    PURCHASE_PRESETS_HBD,
    POINTS_RECEIVING_ACCOUNT,
    PURCHASE_MEMO,
    hbdToPoints,
} from '../../utils/pointsConfig';

type Stage = 'idle' | 'broadcasting' | 'verifying';

/** User-facing copy for a resolved (non-'unverified') purchase outcome. */
function describeResult(result: PurchaseResult): { title: string; message: string } {
    switch (result.status) {
        case 'credited':
            return {
                title: `+${result.pointsCredited.toLocaleString()} points!`,
                message: `New balance: ${result.balance.toLocaleString()} points.`,
            };
        case 'duplicate':
            return { title: 'Already credited', message: 'That transfer was already applied to your balance.' };
        case 'out_of_range':
            return {
                title: 'Amount out of range',
                message: `Purchases must be between ${MIN_PURCHASE_HBD} and ${MAX_PURCHASE_HBD} HBD.`,
            };
        default:
            return { title: '', message: '' };
    }
}

const BuyPointsScreen = (): React.JSX.Element => {
    const theme = useTheme();
    const router = useRouter();
    const { currentUsername } = useAuth();
    const { summary } = usePointsSummary(currentUsername);
    const { transfer, checkStoredKeyAvailable } = useWalletOperations(currentUsername);

    const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<number | null>(PURCHASE_PRESETS_HBD[0] ?? null);
    const [customAmount, setCustomAmount] = useState('');
    const [stage, setStage] = useState<Stage>('idle');
    // Every txid still awaiting verification — a list, not a single slot, so
    // retrying never silently drops an earlier unverified purchase (real HBD
    // already sent) the moment another one is recorded.
    const [pendingTxids, setPendingTxids] = useState<string[]>([]);
    const [isResuming, setIsResuming] = useState(false);

    useEffect(() => {
        checkStoredKeyAvailable().then(setHasStoredKey);
    }, [checkStoredKeyAvailable]);

    const refreshPendingTxids = async (): Promise<void> => {
        if (!currentUsername) return;
        setPendingTxids(await getPendingPurchaseTxids(currentUsername));
    };

    // Resumes every purchase that broadcast successfully on a previous app
    // session (or earlier in this one) but never finished verifying (app
    // killed, network dropped, right after real HBD left the wallet).
    // Also used by the "Retry verification" action below.
    const resumeAndReport = async (): Promise<void> => {
        if (!currentUsername) return;
        setIsResuming(true);
        try {
            const results = await resumePendingPurchases(currentUsername);
            const resolved = results.filter(r => r.status !== 'unverified');
            if (resolved.length > 0) {
                const title = resolved.length === 1 ? describeResult(resolved[0]).title : 'Pending purchases resolved';
                const message = resolved.map(r => describeResult(r).message).join('\n');
                Alert.alert(title, message);
            }
        } finally {
            await refreshPendingTxids();
            setIsResuming(false);
        }
    };

    useEffect(() => {
        if (!currentUsername) return;
        let cancelled = false;
        (async () => {
            const existing = await getPendingPurchaseTxids(currentUsername);
            if (cancelled) return;
            setPendingTxids(existing);
            if (existing.length > 0) await resumeAndReport();
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUsername]);

    const handleRetryVerification = (): void => { void resumeAndReport(); };

    const isBusy = stage !== 'idle' || isResuming;
    // A comma decimal (locale keyboards), trailing junk ("5abc"), or
    // scientific notation ("1e2") must never silently change what gets
    // transferred — parseFloat accepts all three. The 3-decimal cap also
    // keeps this preview equal to what toFixed(3) actually sends.
    const normalizedCustom = customAmount.trim().replace(',', '.');
    const hbdAmount = customAmount
        ? (/^\d+(\.\d{1,3})?$/.test(normalizedCustom) ? Number(normalizedCustom) : NaN)
        : selectedPreset ?? 0;
    const isValidAmount = Number.isFinite(hbdAmount) && hbdAmount >= MIN_PURCHASE_HBD && hbdAmount <= MAX_PURCHASE_HBD;
    const pointsPreview = useMemo(() => (isValidAmount ? hbdToPoints(hbdAmount) : 0), [isValidAmount, hbdAmount]);
    // Blocked while any purchase is still pending verification — letting a
    // new one through here is exactly how an earlier unverified txid used
    // to get buried.
    const canSubmit =
        isValidAmount && !isBusy && pendingTxids.length === 0 && hasStoredKey !== null && (hasStoredKey || activeKeyInput.trim().length > 0);

    const pickPreset = (hbd: number): void => {
        setSelectedPreset(hbd);
        setCustomAmount('');
    };

    const handleBuy = async (): Promise<void> => {
        if (!currentUsername || !isValidAmount || isBusy || pendingTxids.length > 0) return;

        setStage('broadcasting');
        // Tracked separately from `stage` so the catch block below can tell
        // "broadcast never happened, safe to say try again" apart from
        // "HBD already left the wallet, do not say try again".
        let broadcastTxid: string | null = null;
        try {
            const txid = await transfer(
                POINTS_RECEIVING_ACCOUNT,
                hbdAmount.toFixed(3),
                'HBD',
                PURCHASE_MEMO,
                hasStoredKey ? undefined : activeKeyInput.trim()
            );
            broadcastTxid = txid;

            // Persisted BEFORE verification so a crash/kill between here and
            // the result below still leaves a record we can resume from.
            await recordPendingPurchase(currentUsername, txid);
            await refreshPendingTxids();

            setStage('verifying');
            const result = await verifyPointsPurchase(currentUsername, txid);
            await refreshPendingTxids();

            if (result.status === 'unverified') {
                Alert.alert(
                    'Could not verify the transfer yet',
                    'Reopen this screen or tap Retry verification below to check again. If it never confirms, contact support with your transaction ID.'
                );
            } else {
                const { title, message } = describeResult(result);
                Alert.alert(title, message);
                setCustomAmount('');
                setActiveKeyInput('');
            }
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            if (broadcastTxid) {
                // The transfer already broadcast — HBD already left the
                // wallet — so this must never read as "nothing happened,
                // try again" or it invites a second, separate payment.
                Alert.alert(
                    'Transfer sent — verification pending',
                    `Your HBD transfer broadcast successfully (txid: ${broadcastTxid}) but couldn't be verified yet. Do not pay again — tap Retry verification below to check again.`
                );
            } else {
                Alert.alert('Purchase failed', err instanceof Error ? err.message : 'Please try again.');
            }
        } finally {
            setStage('idle');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
                    <FontAwesome name="chevron-left" size={18} color={theme.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Buy Points</Text>
                <View style={{ width: 18 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        {POINTS_PER_HBD} points per HBD. Paid via a normal Hive transfer to @{POINTS_RECEIVING_ACCOUNT}.
                    </Text>
                    <Text style={[styles.balanceText, { color: theme.textSecondary }]}>
                        Current balance: {summary ? summary.balance.toLocaleString() : '—'} points
                    </Text>

                    {pendingTxids.length > 0 && (
                        <View style={[styles.noticeBox, { backgroundColor: theme.infoBoxBackground }]}>
                            <FontAwesome name="exclamation-triangle" size={14} color={theme.icon} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.noticeText, { color: theme.text }]}>
                                    {isResuming
                                        ? 'Confirming your transfer…'
                                        : `We couldn't confirm ${pendingTxids.length > 1 ? `${pendingTxids.length} recent transfers` : 'a recent transfer'} yet. Reopen this screen later, or retry now below. If HBD left your wallet and this doesn't clear, contact support with ${pendingTxids.length > 1 ? 'these transaction IDs' : 'this transaction ID'}: ${pendingTxids.join(', ')}.`}
                                </Text>
                                {!isResuming && (
                                    <Pressable onPress={handleRetryVerification} disabled={isBusy} accessibilityRole="button" accessibilityLabel="Retry verification">
                                        <Text style={[styles.retryText, { color: theme.button }]}>Retry verification</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    )}

                    <View style={[styles.card, { backgroundColor: theme.bubble, borderColor: theme.border }]}>
                        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>AMOUNT (HBD)</Text>
                        <View style={styles.presetRow}>
                            {PURCHASE_PRESETS_HBD.map(hbd => {
                                const active = selectedPreset === hbd && !customAmount;
                                return (
                                    <Pressable
                                        key={hbd}
                                        onPress={() => pickPreset(hbd)}
                                        disabled={isBusy}
                                        style={[
                                            styles.presetButton,
                                            { borderColor: theme.border },
                                            active && { backgroundColor: theme.button, borderColor: theme.button },
                                        ]}
                                    >
                                        <Text style={[styles.presetButtonText, { color: active ? theme.buttonText : theme.text }]}>
                                            {hbd} HBD
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.background }]}
                            placeholder={`Custom amount (${MIN_PURCHASE_HBD}–${MAX_PURCHASE_HBD} HBD)`}
                            placeholderTextColor={theme.textSecondary}
                            value={customAmount}
                            onChangeText={text => { setCustomAmount(text); setSelectedPreset(null); }}
                            keyboardType="decimal-pad"
                            editable={!isBusy}
                        />

                        <View style={[styles.previewRow, { backgroundColor: theme.infoBoxBackground }]}>
                            <View style={styles.previewLabel}>
                                <FontAwesome name="star" size={14} color={theme.icon} />
                                <Text style={[styles.previewLabelText, { color: theme.text }]}>You&apos;ll receive</Text>
                            </View>
                            <Text style={[styles.previewValue, { color: theme.text }]}>
                                {isValidAmount ? `${pointsPreview.toLocaleString()} points` : '—'}
                            </Text>
                        </View>

                        {hasStoredKey === false && (
                            <View style={styles.field}>
                                <Text style={[styles.fieldLabel, { color: theme.text }]}>Active Key</Text>
                                <TextInput
                                    style={[styles.keyInput, { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.background }]}
                                    placeholder="5K..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={activeKeyInput}
                                    onChangeText={setActiveKeyInput}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!isBusy}
                                />
                            </View>
                        )}
                        {hasStoredKey === true && (
                            <View style={[styles.biometricNotice, { backgroundColor: theme.infoBoxBackground }]}>
                                <FontAwesome name="lock" size={14} color={theme.icon} />
                                <Text style={[styles.biometricText, { color: theme.textSecondary }]}>Secured by biometrics</Text>
                            </View>
                        )}

                        <Pressable
                            style={[styles.buyButton, { backgroundColor: canSubmit ? theme.button : theme.buttonInactive }]}
                            onPress={handleBuy}
                            disabled={!canSubmit}
                        >
                            {isBusy ? (
                                <>
                                    <ActivityIndicator size="small" color={canSubmit ? theme.buttonText : theme.text} />
                                    <Text style={[styles.buyButtonText, { color: canSubmit ? theme.buttonText : theme.text }]}>
                                        {stage === 'broadcasting' ? 'Waiting for approval…' : stage === 'verifying' ? 'Verifying…' : 'Confirming…'}
                                    </Text>
                                </>
                            ) : (
                                <Text style={[styles.buyButtonText, { color: canSubmit ? theme.buttonText : theme.text }]}>
                                    Buy {isValidAmount ? pointsPreview.toLocaleString() : ''} Points
                                </Text>
                            )}
                        </Pressable>

                        <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
                            Hive transfers can&apos;t be reversed — double-check the amount before confirming. Points are
                            non-refundable and can only be spent inside Snapie.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default BuyPointsScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 32 },
    subtitle: { fontSize: 13, marginBottom: 4 },
    balanceText: { fontSize: 12, marginBottom: 16 },
    noticeBox: { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
    noticeText: { fontSize: 12, lineHeight: 17 },
    retryText: { fontSize: 13, fontWeight: '700', marginTop: 8 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16 },
    cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    presetButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
    presetButtonText: { fontSize: 13, fontWeight: '600' },
    input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, marginBottom: 14 },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
    },
    previewLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    previewLabelText: { fontSize: 14 },
    previewValue: { fontSize: 17, fontWeight: '700' },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    keyInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, minHeight: 44 },
    biometricNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, marginBottom: 14 },
    biometricText: { fontSize: 13 },
    buyButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, paddingVertical: 14 },
    buyButtonText: { fontSize: 15, fontWeight: '700' },
    disclaimer: { fontSize: 11, marginTop: 12, lineHeight: 16 },
});
