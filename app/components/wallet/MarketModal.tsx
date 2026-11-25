import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { WalletModalShell, AmountField, ActiveKeyField, Callout, type WalletColors } from './walletUi';
import { isAmountValid } from '../../../utils/wallet';
import { minReceive, quoteSwap, SLIPPAGE_CHOICES, type OrderBook, type SwapDirection } from '../../../utils/market';
import { fetchFeedPrice, fetchOrderBook } from '../../../services/marketService';

export type MarketMode = 'swap' | 'convert';

/** Re-read the order book this often while a swap is open. */
const REFRESH_MS = 30_000;

interface MarketModalProps {
    visible: boolean;
    mode: MarketMode;
    initialDirection?: SwapDirection;
    balances: { HIVE: number; HBD: number };
    hasStoredKey: boolean;
    loading: boolean;
    success: boolean;
    colors: WalletColors;
    onClose: () => void;
    onSwap: (direction: SwapDirection, amount: string, minReceive: number, manualKey?: string) => Promise<void>;
    onConvert: (amount: string, manualKey?: string) => Promise<void>;
}

const fmt = (n: number): string => n.toFixed(3);

/**
 * Swap (instant, HIVE ⇄ HBD on Hive's market, fill-or-kill with a slippage
 * cap) and Convert (HBD → HIVE in 3.5 days at the median price feed).
 */
export const MarketModal: React.FC<MarketModalProps> = ({
    visible,
    mode,
    initialDirection = 'HIVE_TO_HBD',
    balances,
    hasStoredKey,
    loading,
    success,
    colors,
    onClose,
    onSwap,
    onConvert,
}) => {
    const [direction, setDirection] = useState<SwapDirection>(initialDirection);
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState<number>(1);
    const [activeKeyInput, setActiveKeyInput] = useState('');
    const [error, setError] = useState('');
    const [book, setBook] = useState<OrderBook | null>(null);
    const [feedPrice, setFeedPrice] = useState<number | null>(null);
    const [priceError, setPriceError] = useState(false);
    /** The minimum shown when the user started typing/reviewing; a refresh can't lower it silently. */
    const [shownMin, setShownMin] = useState<{ key: string; min: number } | null>(null);

    const isSwap = mode === 'swap';
    const sell = isSwap ? (direction === 'HIVE_TO_HBD' ? 'HIVE' : 'HBD') : 'HBD';
    const get = sell === 'HIVE' ? 'HBD' : 'HIVE';
    const available = balances[sell];

    useEffect(() => {
        if (!visible) return;
        setDirection(initialDirection);
        setAmount('');
        setSlippage(1);
        setActiveKeyInput('');
        setError('');
        // Never quote from a book left over from a previous opening.
        setBook(null);
        setShownMin(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const loadPrices = useCallback(async (): Promise<void> => {
        try {
            const [b, f] = await Promise.all([fetchOrderBook(), fetchFeedPrice()]);
            setBook(b);
            setFeedPrice(f);
            setPriceError(false);
        } catch {
            setPriceError(true);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        loadPrices();
        const timer = setInterval(loadPrices, REFRESH_MS);
        return () => clearInterval(timer);
    }, [visible, loadPrices]);

    const value = parseFloat(amount);
    const validAmount = isAmountValid(amount, available);
    const quote = useMemo(
        () => (book && validAmount ? quoteSwap(book, isSwap ? direction : 'HBD_TO_HIVE', value) : null),
        [book, validAmount, isSwap, direction, value]
    );
    const liveMin = quote ? minReceive(quote.exactReceive, slippage) : 0;
    // Keep the minimum the user saw for this amount/direction/slippage: if a
    // price refresh would lower it, the order still asks for what was shown
    // (and simply doesn't fill if the market moved too far).
    const minKey = `${direction}|${amount}|${slippage}`;
    useEffect(() => {
        if (!liveMin) return;
        setShownMin((prev) => (prev && prev.key === minKey && prev.min >= liveMin ? prev : { key: minKey, min: liveMin }));
    }, [minKey, liveMin]);
    const min = shownMin && shownMin.key === minKey ? Math.max(shownMin.min, liveMin) : liveMin;
    const stale = priceError && !!book;
    const convertEstimate = !isSwap && feedPrice && validAmount ? value / feedPrice : null;

    const hasKey = hasStoredKey || activeKeyInput.trim().length > 0;
    const canConfirm = isSwap
        ? validAmount && !!quote?.fillable && min > 0 && hasKey
        : validAmount && hasKey;

    const handleConfirm = async (): Promise<void> => {
        setError('');
        const key = hasStoredKey ? undefined : activeKeyInput.trim();
        try {
            if (isSwap) await onSwap(direction, amount, min, key);
            else await onConvert(amount, key);
        } catch (err) {
            setError(err instanceof Error ? err.message : isSwap ? 'Swap failed' : 'Convert failed');
        }
    };

    return (
        <WalletModalShell
            visible={visible}
            title={isSwap ? `Swap ${sell} → ${get}` : 'Convert HBD → HIVE'}
            term={isSwap ? 'swap' : 'convert'}
            colors={colors}
            loading={loading}
            success={success}
            successText={
                isSwap
                    ? 'Swapped! Your balances update in a few seconds.'
                    : 'Conversion started. The HIVE arrives in about 3.5 days.'
            }
            error={error}
            confirmLabel={isSwap ? 'Swap' : 'Convert'}
            confirmDisabled={!canConfirm}
            onConfirm={handleConfirm}
            onClose={onClose}
        >
            {isSwap && (
                <View style={[styles.toggle, { backgroundColor: colors.bubble }]}>
                    {(['HIVE_TO_HBD', 'HBD_TO_HIVE'] as const).map((d) => {
                        const selected = d === direction;
                        return (
                            <Pressable
                                key={d}
                                style={[styles.toggleOption, selected && { backgroundColor: colors.button }]}
                                onPress={() => {
                                    setDirection(d);
                                    setAmount('');
                                }}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                            >
                                <Text style={[styles.toggleText, { color: selected ? colors.buttonText : colors.text }]}>
                                    {d === 'HIVE_TO_HBD' ? 'HIVE → HBD' : 'HBD → HIVE'}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            )}

            {isSwap ? (
                <Callout colors={colors}>
                    Instant, at today’s market prices. It fills completely or not at all, and never for less than the minimum below.
                </Callout>
            ) : (
                <Callout colors={colors} tone="warning">
                    The HIVE arrives in about 3.5 days, at the median price over that time. A conversion can’t be cancelled.
                </Callout>
            )}

            <AmountField
                colors={colors}
                unit={sell}
                available={available}
                availableLabel={`Available ${sell}`}
                term={sell === 'HBD' ? 'hbd' : 'hive'}
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
            />

            {/* Price summary */}
            <View style={[styles.summary, { backgroundColor: colors.bubble }]}>
                {priceError && !book ? (
                    <Pressable onPress={loadPrices} accessibilityRole="button">
                        <Text style={[styles.summaryText, { color: colors.error ?? '#E74C3C' }]}>
                            Couldn’t load market prices. Tap to retry.
                        </Text>
                    </Pressable>
                ) : !book || !feedPrice ? (
                    <ActivityIndicator size="small" color={colors.icon} />
                ) : !validAmount ? (
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                        1 HIVE ≈ {feedPrice.toFixed(4)} HBD (price feed)
                    </Text>
                ) : isSwap ? (
                    quote && quote.fillable ? (
                        <>
                            <Row label="You get about" value={`${fmt(quote.receive)} ${get}`} colors={colors} strong />
                            <Row label="At least" value={`${fmt(min)} ${get}`} colors={colors} />
                            <Row label="Average price" value={`${quote.averagePrice.toFixed(4)} HBD per HIVE`} colors={colors} />
                            {stale && (
                                <Text style={[styles.note, { color: colors.error ?? '#E74C3C' }]}>
                                    Couldn’t refresh prices; these may be out of date. Tap ↻ to retry.
                                </Text>
                            )}
                        </>
                    ) : (
                        <Text style={[styles.summaryText, { color: colors.error ?? '#E74C3C' }]}>
                            There isn’t enough {get} on the market right now for this amount. Try a smaller one.
                        </Text>
                    )
                ) : (
                    <>
                        <Row label="Estimated" value={`${fmt(convertEstimate ?? 0)} HIVE`} colors={colors} strong />
                        <Text style={[styles.note, { color: colors.textSecondary }]}>
                            At today’s feed price; the final amount uses the median over the next 3.5 days.
                            {quote?.fillable ? ` A swap would give about ${fmt(quote.receive)} HIVE right now.` : ''}
                        </Text>
                    </>
                )}
            </View>

            {isSwap && (
                <View style={styles.slippageRow}>
                    <Text style={[styles.slippageLabel, { color: colors.text }]}>Max price change</Text>
                    {SLIPPAGE_CHOICES.map((s) => {
                        const selected = s === slippage;
                        return (
                            <Pressable
                                key={s}
                                onPress={() => setSlippage(s)}
                                disabled={loading}
                                style={[
                                    styles.pill,
                                    { borderColor: selected ? colors.button : colors.inputBorder },
                                    selected && { backgroundColor: colors.button },
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`Allow ${s}% price change`}
                            >
                                <Text style={[styles.pillText, { color: selected ? colors.buttonText : colors.text }]}>{s}%</Text>
                            </Pressable>
                        );
                    })}
                    <Pressable onPress={loadPrices} hitSlop={8} accessibilityRole="button" accessibilityLabel="Refresh prices">
                        <FontAwesome name="refresh" size={14} color={colors.icon} />
                    </Pressable>
                </View>
            )}

            <ActiveKeyField
                colors={colors}
                hasStoredKey={hasStoredKey}
                value={activeKeyInput}
                onChangeText={setActiveKeyInput}
                editable={!loading}
            />
        </WalletModalShell>
    );
};

const Row: React.FC<{ label: string; value: string; colors: WalletColors; strong?: boolean }> = ({ label, value, colors, strong }) => (
    <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }, strong && styles.rowStrong]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    toggle: { flexDirection: 'row', borderRadius: 8, padding: 3, marginBottom: 14 },
    toggleOption: { flex: 1, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
    toggleText: { fontSize: 14, fontWeight: '600' },
    summary: { borderRadius: 8, padding: 12, marginBottom: 14, gap: 6, minHeight: 44, justifyContent: 'center' },
    summaryText: { fontSize: 13, textAlign: 'center' },
    note: { fontSize: 12, lineHeight: 17 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { fontSize: 13 },
    rowValue: { fontSize: 13, fontWeight: '600' },
    rowStrong: { fontSize: 15, fontWeight: '700' },
    slippageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    slippageLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
    pill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontSize: 13, fontWeight: '600' },
});
