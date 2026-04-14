import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { TransactionItem } from '../../../hooks/useAccountHistory';

interface Colors {
    text: string;
    textSecondary: string;
    bubble: string;
    border: string;
    icon: string;
    success: string;
    error: string;
}

interface Props {
    transactions: TransactionItem[];
    loading: boolean;
    error: string | null;
    colors: Colors;
}

const formatRelativeTime = (isoTimestamp: string): string => {
    // Hive timestamps are UTC but lack the trailing 'Z' — add it
    const ts = isoTimestamp.endsWith('Z') ? isoTimestamp : `${isoTimestamp}Z`;
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const OP_META: Record<
    string,
    { label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }
> = {
    transfer:             { label: 'Transfer',    icon: 'exchange' },
    transfer_to_vesting:  { label: 'Power Up',    icon: 'arrow-circle-up' },
    fill_vesting_withdraw:{ label: 'Power Down',  icon: 'arrow-circle-down' },
    claim_reward_balance: { label: 'Rewards',     icon: 'star' },
};

const TransactionRow = ({
    tx,
    colors,
}: {
    tx: TransactionItem;
    colors: Colors;
}) => {
    const meta = OP_META[tx.type] ?? { label: tx.type, icon: 'circle' as const };
    const isIn = tx.direction === 'in';
    const isOut = tx.direction === 'out';

    const amountColor = isIn
        ? colors.success
        : isOut
        ? colors.error
        : colors.text;

    const amountPrefix = isIn ? '+' : isOut ? '-' : '';

    return (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
            {/* Icon */}
            <View style={[styles.iconWrap, { backgroundColor: colors.bubble }]}>
                <FontAwesome name={meta.icon} size={15} color={colors.icon} />
            </View>

            {/* Center: label + counterparty */}
            <View style={styles.center}>
                <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                    {meta.label}
                    {tx.counterparty ? (
                        <Text style={{ color: colors.textSecondary }}>
                            {isOut ? '  →  ' : '  ←  '}
                            <Text style={{ fontWeight: '600' }}>@{tx.counterparty}</Text>
                        </Text>
                    ) : null}
                </Text>
                {tx.memo ? (
                    <Text style={[styles.memo, { color: colors.textSecondary }]} numberOfLines={1}>
                        {tx.memo}
                    </Text>
                ) : null}
                <Text style={[styles.time, { color: colors.textSecondary }]}>
                    {formatRelativeTime(tx.timestamp)}
                </Text>
            </View>

            {/* Right: amount */}
            <View style={styles.amountWrap}>
                <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
                    {amountPrefix}{tx.amount}
                </Text>
                {tx.secondaryAmount ? (
                    <Text style={[styles.secondaryAmount, { color: colors.textSecondary }]} numberOfLines={1}>
                        +{tx.secondaryAmount}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

export const TransactionList = ({ transactions, loading, error, colors }: Props): React.JSX.Element => {
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.icon} />
            </View>
        );
    }

    if (error) {
        return (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
        );
    }

    if (transactions.length === 0) {
        return (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No recent transactions
            </Text>
        );
    }

    return (
        <View style={[styles.listContainer, { backgroundColor: colors.bubble }]}>
            {transactions.map((tx, idx) => (
                <TransactionRow
                    key={tx.id}
                    tx={tx}
                    colors={colors}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    listContainer: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        gap: 2,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    memo: {
        fontSize: 12,
    },
    time: {
        fontSize: 11,
    },
    amountWrap: {
        alignItems: 'flex-end',
        flexShrink: 0,
        maxWidth: 130,
    },
    amount: {
        fontSize: 13,
        fontWeight: '700',
    },
    secondaryAmount: {
        fontSize: 11,
        marginTop: 2,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 16,
    },
});
