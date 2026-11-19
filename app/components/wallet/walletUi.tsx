/**
 * Shared building blocks for the wallet's action modals: the modal shell
 * (title, broadcasting / success states, Cancel + confirm buttons), an
 * amount field with available balance + MAX, the active-key field, and
 * the "What is this?" explainer button.
 */
import React from 'react';
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
    Alert,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { WALLET_TERMS, type WalletTerm } from '../../../utils/walletTerms';
import { amountError, formatMax } from '../../../utils/wallet';

export interface WalletColors {
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
    warningBoxBackground?: string;
    error?: string;
}

const FALLBACK_ERROR = '#E74C3C';

/** Small (i) button that explains a wallet term. */
export const TermInfo: React.FC<{ term: WalletTerm; color: string; size?: number }> = ({ term, color, size = 14 }) => {
    const { title, body } = WALLET_TERMS[term];
    return (
        <Pressable
            onPress={() => Alert.alert(title, body)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`What is ${title}?`}
            style={styles.termInfo}
        >
            <FontAwesome name="info-circle" size={size} color={color} />
        </Pressable>
    );
};

interface WalletModalShellProps {
    visible: boolean;
    title: string;
    term?: WalletTerm;
    colors: WalletColors;
    loading: boolean;
    success: boolean;
    successText: string;
    error?: string;
    confirmLabel: string;
    confirmDisabled: boolean;
    onConfirm: () => void;
    onClose: () => void;
    children: React.ReactNode;
}

export const WalletModalShell: React.FC<WalletModalShellProps> = ({
    visible,
    title,
    term,
    colors,
    loading,
    success,
    successText,
    error,
    confirmLabel,
    confirmDisabled,
    onConfirm,
    onClose,
    children,
}) => {
    const enabled = !confirmDisabled && !loading;
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.content, { backgroundColor: colors.background }]}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        {term && <TermInfo term={term} color={colors.textSecondary} />}
                    </View>

                    {loading ? (
                        <View style={styles.statusContainer}>
                            <ActivityIndicator size="large" color={colors.icon} />
                            <Text style={[styles.statusText, { color: colors.text }]}>Broadcasting transaction...</Text>
                        </View>
                    ) : success ? (
                        <View style={styles.statusContainer}>
                            <FontAwesome name="check-circle" size={40} color={colors.button} />
                            <Text style={[styles.statusText, { color: colors.text }]}>{successText}</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {children}

                            {error ? (
                                <Text style={[styles.errorText, { color: colors.error ?? FALLBACK_ERROR }]}>{error}</Text>
                            ) : null}

                            <View style={styles.buttons}>
                                <Pressable
                                    style={[styles.button, { backgroundColor: colors.buttonInactive }]}
                                    onPress={onClose}
                                    accessibilityRole="button"
                                >
                                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.button,
                                        { backgroundColor: enabled ? colors.button : colors.buttonInactive, marginLeft: 8 },
                                    ]}
                                    onPress={onConfirm}
                                    disabled={!enabled}
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: !enabled }}
                                >
                                    <Text style={[styles.buttonText, { color: enabled ? colors.buttonText : colors.text }]}>
                                        {confirmLabel}
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

/** Info or warning callout used at the top of a modal. */
export const Callout: React.FC<{ colors: WalletColors; tone?: 'info' | 'warning'; children: React.ReactNode }> = ({
    colors,
    tone = 'info',
    children,
}) => (
    <View
        style={[
            styles.callout,
            { backgroundColor: tone === 'warning' ? colors.warningBoxBackground ?? colors.infoBoxBackground : colors.infoBoxBackground },
        ]}
    >
        <FontAwesome name={tone === 'warning' ? 'warning' : 'info-circle'} size={14} color={colors.icon} />
        <Text style={[styles.calloutText, { color: tone === 'warning' ? colors.text : colors.textSecondary }]}>{children}</Text>
    </View>
);

/**
 * A status line with a secondary outline button under it — e.g. "Power down
 * active" + "Cancel Power Down", or a current delegation + "Remove".
 */
export const StatusAction: React.FC<{
    colors: WalletColors;
    icon: React.ComponentProps<typeof FontAwesome>['name'];
    text: string;
    actionLabel: string;
    onAction: () => void;
    disabled?: boolean;
}> = ({ colors, icon, text, actionLabel, onAction, disabled }) => (
    <View style={[styles.statusAction, { backgroundColor: colors.infoBoxBackground }]}>
        <View style={styles.inlineRow}>
            <FontAwesome name={icon} size={13} color={colors.icon} />
            <Text style={[styles.statusActionText, { color: colors.text }]}>{text}</Text>
        </View>
        <Pressable
            style={[styles.statusActionButton, { borderColor: colors.buttonInactive, opacity: disabled ? 0.5 : 1 }]}
            onPress={onAction}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
        >
            <Text style={[styles.statusActionButtonText, { color: colors.text }]}>{actionLabel}</Text>
        </Pressable>
    </View>
);

interface AmountFieldProps {
    colors: WalletColors;
    label?: string;
    unit: string;
    /** What's available for this action; MAX fills it and the amount is checked against it. */
    available: number;
    availableLabel?: string;
    term?: WalletTerm;
    value: string;
    onChangeText: (v: string) => void;
    editable?: boolean;
    /** Extra line under the input (e.g. "≈ 12.000 HP"). */
    hint?: string | null;
}

export const AmountField: React.FC<AmountFieldProps> = ({
    colors,
    label = 'Amount',
    unit,
    available,
    availableLabel = 'Available',
    term,
    value,
    onChangeText,
    editable = true,
    hint,
}) => {
    const message = amountError(value, available);
    return (
        <>
            <View style={[styles.balanceRow, { backgroundColor: colors.bubble }]}>
                <View style={styles.inlineRow}>
                    <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>{availableLabel}</Text>
                    {term && <TermInfo term={term} color={colors.textSecondary} size={12} />}
                </View>
                <Text style={[styles.balanceValue, { color: colors.text }]}>
                    {available.toFixed(3)} {unit}
                </Text>
            </View>
            <View style={styles.field}>
                <View style={styles.amountHeader}>
                    <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 0 }]}>{label}</Text>
                    <Pressable
                        onPress={() => onChangeText(formatMax(available))}
                        disabled={!editable}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Use maximum, ${formatMax(available)} ${unit}`}
                    >
                        <Text style={[styles.maxButton, { color: colors.button }]}>MAX</Text>
                    </Pressable>
                </View>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                    placeholder={`0.000 ${unit}`}
                    placeholderTextColor={colors.textSecondary}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="decimal-pad"
                    editable={editable}
                />
                {hint ? <Text style={[styles.hintText, { color: colors.textSecondary }]}>{hint}</Text> : null}
                {message ? <Text style={[styles.errorText, { color: colors.error ?? FALLBACK_ERROR }]}>{message}</Text> : null}
            </View>
        </>
    );
};

interface ActiveKeyFieldProps {
    colors: WalletColors;
    hasStoredKey: boolean;
    value: string;
    onChangeText: (v: string) => void;
    editable?: boolean;
}

/** "Secured by biometrics" when a key is stored, otherwise an active key input. */
export const ActiveKeyField: React.FC<ActiveKeyFieldProps> = ({ colors, hasStoredKey, value, onChangeText, editable = true }) =>
    hasStoredKey ? (
        <View style={[styles.biometricNotice, { backgroundColor: colors.infoBoxBackground }]}>
            <FontAwesome name="lock" size={14} color={colors.icon} />
            <Text style={[styles.biometricText, { color: colors.textSecondary }]}>Secured by biometrics</Text>
        </View>
    ) : (
        <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Active Key</Text>
            <TextInput
                style={[styles.keyInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.bubble }]}
                placeholder="5K..."
                placeholderTextColor={colors.textSecondary}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable}
            />
        </View>
    );

export const walletUiStyles = StyleSheet.create({
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    input: {
        height: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    errorText: { fontSize: 13, marginTop: 4 },
    hintText: { fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
    ...walletUiStyles,
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    termInfo: { marginLeft: 6 },
    statusContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
    statusText: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
    callout: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        alignItems: 'flex-start',
    },
    calloutText: { fontSize: 13, lineHeight: 18, flex: 1 },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
    },
    inlineRow: { flexDirection: 'row', alignItems: 'center' },
    statusAction: { padding: 12, borderRadius: 8, marginBottom: 14, gap: 10 },
    statusActionText: { fontSize: 13, fontWeight: '500', marginLeft: 8, flex: 1 },
    statusActionButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
    statusActionButtonText: { fontSize: 13, fontWeight: '600' },
    balanceLabel: { fontSize: 13 },
    balanceValue: { fontSize: 14, fontWeight: '600' },
    amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    maxButton: { fontSize: 12, fontWeight: '700' },
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
    buttons: { flexDirection: 'row', marginTop: 8 },
    button: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
    buttonText: { fontSize: 15, fontWeight: '600' },
});
