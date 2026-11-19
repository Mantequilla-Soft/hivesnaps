import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { getClient } from '../../../services/HiveClient';
import { useAvatar } from '../../../hooks/useAvatar';
import { walletUiStyles, type WalletColors } from './walletUi';

const client = getClient();

export type UsernameLookupStatus = 'idle' | 'checking' | 'found' | 'not-found';

// User asked for "1, maybe 2 seconds" so they're clearly done typing before
// this spends a network call — same debounce snapie-io's WalletModal uses.
const USERNAME_LOOKUP_DEBOUNCE_MS = 1000;

/** "@Foo " → "foo" */
export const normalizeUsername = (raw: string): string => raw.trim().replace(/^@/, '').toLowerCase();

interface RecipientFieldProps {
    colors: WalletColors;
    label?: string;
    value: string;
    onChangeText: (v: string) => void;
    onStatusChange: (status: UsernameLookupStatus) => void;
    editable?: boolean;
}

/**
 * Username input with a debounced lookup — confirms the typed account is
 * real and shows its avatar, so a mistyped recipient is obvious before
 * confirming rather than after (mirrors snapie-io's WalletModal).
 */
export const RecipientField: React.FC<RecipientFieldProps> = ({
    colors,
    label = 'To',
    value,
    onChangeText,
    onStatusChange,
    editable = true,
}) => {
    const [status, setStatus] = useState<UsernameLookupStatus>('idle');

    useEffect(() => {
        onStatusChange(status);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    // Clear the parent's lookup status when this field leaves the tree, so a
    // stale 'not-found' can't keep blocking a form that no longer shows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => onStatusChange('idle'), []);

    useEffect(() => {
        const trimmed = normalizeUsername(value);
        if (!trimmed) {
            setStatus('idle');
            return;
        }
        // Hive account names are capped at 16 chars — the RPC node throws
        // for anything longer, which isn't a network hiccup, it's a
        // definite "not a real account."
        if (trimmed.length > 16) {
            setStatus('not-found');
            return;
        }
        setStatus('checking');
        let cancelled = false;
        const timeoutId = setTimeout(async () => {
            try {
                const accounts = await client.database.getAccounts([trimmed]);
                if (!cancelled) setStatus(accounts.length > 0 ? 'found' : 'not-found');
            } catch {
                // Network hiccup — don't block on a failed check, just drop
                // back to no verdict shown.
                if (!cancelled) setStatus('idle');
            }
        }, USERNAME_LOOKUP_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [value]);

    const { avatarUrl } = useAvatar(status === 'found' ? normalizeUsername(value) : null);
    const errorColor = colors.error ?? '#E74C3C';

    return (
        <View style={walletUiStyles.field}>
            <Text style={[walletUiStyles.fieldLabel, { color: colors.text }]}>{label}</Text>
            <View style={styles.row}>
                <TextInput
                    style={[
                        walletUiStyles.input,
                        styles.input,
                        {
                            color: colors.text,
                            borderColor: status === 'not-found' ? errorColor : colors.inputBorder,
                            backgroundColor: colors.bubble,
                        },
                    ]}
                    placeholder="@username"
                    placeholderTextColor={colors.textSecondary}
                    value={value}
                    onChangeText={onChangeText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={editable}
                />
                {status === 'checking' && <ActivityIndicator size="small" color={colors.icon} />}
                {status === 'found' && <ExpoImage source={{ uri: avatarUrl }} style={styles.avatar} />}
            </View>
            {status === 'not-found' && (
                <Text style={[walletUiStyles.errorText, { color: errorColor }]}>No Hive account found with this username.</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: { flex: 1 },
    avatar: { width: 32, height: 32, borderRadius: 16 },
});
