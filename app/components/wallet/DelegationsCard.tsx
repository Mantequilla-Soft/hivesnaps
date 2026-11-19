import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { TermInfo, type WalletColors } from './walletUi';
import { useAvatar } from '../../../hooks/useAvatar';
import type { OutgoingDelegation } from '../../../utils/wallet';

interface DelegationsCardProps {
    colors: WalletColors;
    delegations: OutgoingDelegation[];
    receivedHivePower: number;
    onAdd: () => void;
    onEdit: (d: OutgoingDelegation) => void;
}

const DelegationRow: React.FC<{ d: OutgoingDelegation; colors: WalletColors; onPress: () => void }> = ({ d, colors, onPress }) => {
    const { avatarUrl } = useAvatar(d.delegatee);
    return (
        <Pressable
            style={({ pressed }) => [styles.row, { borderColor: colors.inputBorder, opacity: pressed ? 0.7 : 1 }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Delegating ${d.hp.toFixed(3)} HP to ${d.delegatee}. Tap to change or remove.`}
        >
            <ExpoImage source={avatarUrl ? { uri: avatarUrl } : undefined} style={[styles.avatar, { backgroundColor: colors.inputBorder }]} />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                @{d.delegatee}
            </Text>
            <Text style={[styles.hp, { color: colors.text }]}>{d.hp.toFixed(3)} HP</Text>
            <FontAwesome name="pencil" size={13} color={colors.textSecondary} />
        </Pressable>
    );
};

export const DelegationsCard: React.FC<DelegationsCardProps> = ({ colors, delegations, receivedHivePower, onAdd, onEdit }) => (
    <View style={[styles.card, { backgroundColor: colors.bubble }]}>
        <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textSecondary }]}>DELEGATIONS</Text>
            <TermInfo term="delegation" color={colors.textSecondary} size={13} />
            <Pressable onPress={onAdd} hitSlop={8} style={styles.add} accessibilityRole="button" accessibilityLabel="Delegate Hive Power">
                <FontAwesome name="plus" size={12} color={colors.button} />
                <Text style={[styles.addText, { color: colors.button }]}>Delegate</Text>
            </Pressable>
        </View>

        {delegations.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>You aren’t delegating any Hive Power.</Text>
        ) : (
            <View style={styles.list}>
                {delegations.map((d) => (
                    <DelegationRow key={d.delegatee} d={d} colors={colors} onPress={() => onEdit(d)} />
                ))}
            </View>
        )}

        {receivedHivePower > 0 && (
            <Text style={[styles.received, { color: colors.textSecondary }]}>
                Others delegate {receivedHivePower.toFixed(3)} HP to you.
            </Text>
        )}
    </View>
);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 20, marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
    add: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
    addText: { fontSize: 13, fontWeight: '700' },
    empty: { fontSize: 13 },
    list: { gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
    avatar: { width: 28, height: 28, borderRadius: 14 },
    name: { flex: 1, fontSize: 14, fontWeight: '500' },
    hp: { fontSize: 14, fontWeight: '600' },
    received: { fontSize: 12, marginTop: 12 },
});
