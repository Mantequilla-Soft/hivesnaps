import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { hiveAccountExists } from '../../utils/hiveUsername';
import {
    allocatedWeight,
    formatPercent,
    remainingWeight,
    validateBeneficiary,
    SNAPIE_BENEFICIARY,
    MAX_BENEFICIARY_WEIGHT,
    type Beneficiary,
} from '../../utils/beneficiaries';

interface BeneficiariesEditorProps {
    beneficiaries: Beneficiary[];
    snapieWeight: number;
    author: string | null;
    onAdd: (beneficiary: Beneficiary) => void;
    onRemove: (account: string) => void;
    colors: {
        background: string;
        text: string;
        inputBorder: string;
        button: string;
        buttonText: string;
        buttonInactive: string;
        info: string;
        error: string;
    };
}

/**
 * Blog composer: share a post's rewards with other accounts (on top of
 * @snapie's fixed share), mirroring snapie.io's BeneficiariesInput. Each
 * account is checked to exist before it's added, so a typo can't make the
 * post fail at publish time.
 */
export const BeneficiariesEditor: React.FC<BeneficiariesEditorProps> = ({
    beneficiaries,
    snapieWeight,
    author,
    onAdd,
    onRemove,
    colors,
}) => {
    const [expanded, setExpanded] = useState(beneficiaries.length > 0);
    const [account, setAccount] = useState('');
    const [percent, setPercent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    // Blocks a second tap before `checking` re-renders the button disabled.
    const inFlightRef = useRef(false);
    // Latest list and share, for re-checking after the (async) lookup.
    const latestRef = useRef({ beneficiaries, snapieWeight });
    latestRef.current = { beneficiaries, snapieWeight };

    const allocated = allocatedWeight(beneficiaries, snapieWeight);
    const overAllocated = allocated > MAX_BENEFICIARY_WEIGHT;
    const remaining = remainingWeight(beneficiaries, snapieWeight);

    const add = async (): Promise<void> => {
        if (inFlightRef.current) return;
        const first = validateBeneficiary(beneficiaries, account, percent, { author, snapieWeight });
        if (!first.ok) {
            setError(first.error);
            return;
        }
        const { account: name } = first.beneficiary;
        inFlightRef.current = true;
        setChecking(true);
        setError(null);
        try {
            if (!(await hiveAccountExists(name))) {
                setError(`@${name} doesn't exist on Hive.`);
                return;
            }
            // The list or @snapie's share (video/audio attached) may have
            // changed while we waited; check again against the latest.
            const latest = latestRef.current;
            const again = validateBeneficiary(latest.beneficiaries, account, percent, {
                author,
                snapieWeight: latest.snapieWeight,
            });
            if (!again.ok) {
                setError(again.error);
                return;
            }
            onAdd(again.beneficiary);
            setAccount('');
            setPercent('');
        } catch {
            setError('Couldn’t check that account. Try again.');
        } finally {
            inFlightRef.current = false;
            setChecking(false);
        }
    };

    const inputStyle = [styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }];

    return (
        <View style={[styles.box, { borderColor: colors.inputBorder }]}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel="Reward beneficiaries"
            >
                <Text style={[styles.title, { color: colors.text }]}>Reward beneficiaries</Text>
                <Text style={[styles.allocated, { color: overAllocated ? colors.error : colors.info }]}>
                    {formatPercent(allocated)} shared
                </Text>
                <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.info} />
            </TouchableOpacity>

            {expanded && (
                <View style={[styles.body, { borderTopColor: colors.inputBorder }]}>
                    <Text style={[styles.hint, { color: colors.info }]}>
                        Share part of this post’s rewards with other accounts. Beneficiaries can’t be changed after publishing.
                    </Text>

                    <View style={styles.row}>
                        <FontAwesome name="lock" size={13} color={colors.info} />
                        <Text style={[styles.rowName, { color: colors.text }]}>@{SNAPIE_BENEFICIARY}</Text>
                        <Text style={[styles.rowWeight, { color: colors.info }]}>{formatPercent(snapieWeight)}</Text>
                    </View>
                    {beneficiaries.map((b) => (
                        <View key={b.account} style={styles.row}>
                            <FontAwesome name="user" size={13} color={colors.info} />
                            <Text style={[styles.rowName, { color: colors.text }]}>@{b.account}</Text>
                            <Text style={[styles.rowWeight, { color: colors.text }]}>{formatPercent(b.weight)}</Text>
                            <TouchableOpacity
                                onPress={() => onRemove(b.account)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove @${b.account}`}
                            >
                                <FontAwesome name="times" size={15} color={colors.info} />
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Above the inputs, so it stays visible when the keyboard covers what's below them. */}
                    {error ? (
                        <Text style={[styles.message, { color: colors.error }]}>{error}</Text>
                    ) : overAllocated ? (
                        <Text style={[styles.message, { color: colors.error }]}>
                            Beneficiaries add up to more than 100% (@{SNAPIE_BENEFICIARY}’s share grows to {formatPercent(snapieWeight)} with video or audio). Remove some before publishing.
                        </Text>
                    ) : (
                        <Text style={[styles.message, { color: colors.info }]}>{formatPercent(remaining)} left to share</Text>
                    )}
                    <View style={styles.addRow}>
                        <TextInput
                            style={[inputStyle, styles.accountInput]}
                            value={account}
                            onChangeText={(t) => { setAccount(t); setError(null); }}
                            placeholder="@username"
                            placeholderTextColor={colors.info}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!checking}
                            accessibilityLabel="Beneficiary account"
                        />
                        <TextInput
                            style={[inputStyle, styles.percentInput]}
                            value={percent}
                            onChangeText={(t) => { setPercent(t); setError(null); }}
                            placeholder="%"
                            placeholderTextColor={colors.info}
                            keyboardType="decimal-pad"
                            editable={!checking}
                            accessibilityLabel="Beneficiary percentage"
                        />
                        <TouchableOpacity
                            onPress={add}
                            disabled={checking || remaining === 0}
                            style={[
                                styles.addButton,
                                { backgroundColor: checking || remaining === 0 ? colors.buttonInactive : colors.button },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Add beneficiary"
                        >
                            {checking ? (
                                <ActivityIndicator size="small" color={colors.buttonText} />
                            ) : (
                                <FontAwesome name="plus" size={14} color={colors.buttonText} />
                            )}
                        </TouchableOpacity>
                    </View>

                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    box: { borderWidth: 1, borderRadius: 12, marginBottom: 16 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    title: { fontSize: 15, fontWeight: '600', flex: 1 },
    allocated: { fontSize: 13 },
    body: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
    hint: { fontSize: 12, marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    rowName: { flex: 1, fontSize: 14 },
    rowWeight: { fontSize: 14, fontWeight: '600', minWidth: 48, textAlign: 'right' },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
    accountInput: { flex: 1 },
    percentInput: { width: 64, textAlign: 'center' },
    addButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    message: { fontSize: 12 },
});
