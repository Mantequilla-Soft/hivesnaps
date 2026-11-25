import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../store/context';
import { createWalletScreenStyles } from '../../styles/WalletScreenStyles';
import { canCollectHbdInterest, type SavingsWithdrawal, type OutgoingDelegation } from '../../utils/wallet';
import { useWalletData } from '../../hooks/useWalletData';
import { hasPendingRewards } from '../../utils/pendingRewards';
import { usePendingRewards } from '../../hooks/usePendingRewards';
import PendingRewardsBanner from '../components/PendingRewardsBanner';
import { SavingsModal, type SavingsMode } from '../components/wallet/SavingsModal';
import { MarketModal, type MarketMode } from '../components/wallet/MarketModal';
import { SavingsCard } from '../components/wallet/SavingsCard';
import { CancelWithdrawModal } from '../components/wallet/CancelWithdrawModal';
import { DelegateModal } from '../components/wallet/DelegateModal';
import { DelegationsCard } from '../components/wallet/DelegationsCard';
import { TermInfo } from '../components/wallet/walletUi';
import { useWalletOperations } from '../../hooks/useWalletOperations';
import { useAccountHistory } from '../../hooks/useAccountHistory';
import { TransferModal } from '../components/wallet/TransferModal';
import { PowerUpModal } from '../components/wallet/PowerUpModal';
import { PowerDownModal } from '../components/wallet/PowerDownModal';
import { TransactionList } from '../components/wallet/TransactionList';
import PileMarketSection from '../components/wallet/PileMarketSection';
import { RequestPaymentModal } from '../components/wallet/RequestPaymentModal';
import { ScanPaymentModal } from '../components/wallet/ScanPaymentModal';
import { AuthCancelledError } from '../../services/LocalAuthService';
import { currencyFromAmount, valueFromAmount, HiveTransferQRData } from '../../utils/hiveQr';


const SUCCESS_DISMISS_MS = 2500;

/** Runs `onDismiss` once, SUCCESS_DISMISS_MS after `success` turns true. */
function useDismissAfterSuccess(success: boolean, onDismiss: () => void): void {
    const latest = useRef(onDismiss);
    latest.current = onDismiss;
    useEffect(() => {
        if (!success) return;
        const id = setTimeout(() => latest.current(), SUCCESS_DISMISS_MS);
        return () => clearTimeout(id);
    }, [success]);
}

const WalletScreen = (): React.JSX.Element => {
    const theme = useTheme();
    const { isDark } = theme;
    const router = useRouter();
    const { currentUsername } = useAuth();

    const styles = useMemo(() => createWalletScreenStyles(isDark), [isDark]);

    const colors = {
        background: theme.background,
        text: theme.text,
        textSecondary: theme.textSecondary,
        bubble: theme.bubble,
        border: theme.border,
        icon: theme.icon,
        button: theme.button,
        buttonText: theme.buttonText,
        buttonInactive: theme.buttonInactive,
        inputBorder: theme.inputBorder,
        infoBoxBackground: theme.infoBoxBackground,
        warningBoxBackground: theme.warningBoxBackground,
        error: theme.error,
        success: theme.success,
    };

    // Wallet data state

    // Modal visibility
    const [transferHiveVisible, setTransferHiveVisible] = useState(false);
    const [transferHbdVisible, setTransferHbdVisible] = useState(false);
    const [powerUpVisible, setPowerUpVisible] = useState(false);
    const [powerDownVisible, setPowerDownVisible] = useState(false);
    const [requestPaymentVisible, setRequestPaymentVisible] = useState(false);
    const [scanPaymentVisible, setScanPaymentVisible] = useState(false);
    const [transferPrefill, setTransferPrefill] = useState<{ to: string; amount: string; memo: string } | null>(null);
    const [savingsMode, setSavingsMode] = useState<SavingsMode | null>(null);
    const [marketMode, setMarketMode] = useState<MarketMode | null>(null);
    const [savingsCurrency, setSavingsCurrency] = useState<'HIVE' | 'HBD'>('HBD');
    const [withdrawalToCancel, setWithdrawalToCancel] = useState<SavingsWithdrawal | null>(null);
    const [delegateVisible, setDelegateVisible] = useState(false);
    const [delegationToEdit, setDelegationToEdit] = useState<OutgoingDelegation | null>(null);

    // Stored key availability (checked once on mount)
    const [storedKeyAvailable, setStoredKeyAvailable] = useState(false);

    const {
        transactions,
        loading: historyLoading,
        error: historyError,
        fetchHistory,
    } = useAccountHistory(currentUsername, 10);

    const {
        walletData,
        globalProps,
        withdrawals,
        delegations,
        extrasFailed,
        loading,
        refreshing,
        loadError,
        reload: fetchWalletData,
    } = useWalletData(currentUsername);

    useEffect(() => {
        if (loadError) Alert.alert('Error', loadError);
    }, [loadError]);

    // Silent reloads reject when an optional list still fails; the card keeps
    // showing its Retry prompt, so there's nothing more to report here.
    const retryExtras = useCallback((): void => {
        fetchWalletData(true).catch(() => {});
    }, [fetchWalletData]);

    const { rewards: pendingRewards, refresh: refreshRewards } = usePendingRewards(currentUsername);
    const showRewards = !!pendingRewards && hasPendingRewards(pendingRewards);

    const {
        transferLoading, transferSuccess,
        powerUpLoading, powerUpSuccess,
        powerDownLoading, powerDownSuccess,
        savingsLoading, savingsSuccess,
        delegateLoading, delegateSuccess,
        marketLoading, marketSuccess,
        claimLoading,
        transfer, powerUp, powerDown, cancelPowerDown,
        depositToSavings, withdrawFromSavings, cancelSavingsWithdraw,
        delegate, claimRewards,
        swap, convertHbd,
        resetOperationSuccess,
        checkStoredKeyAvailable,
    } = useWalletOperations(currentUsername, async () => {
        await fetchWalletData(true);
        await fetchHistory();
        await refreshRewards();
    });


    useEffect(() => {
        fetchWalletData();
        fetchHistory();
    }, [fetchWalletData, fetchHistory]);

    useEffect(() => {
        let cancelled = false;
        checkStoredKeyAvailable().then((available) => {
            if (!cancelled) setStoredKeyAvailable(available);
        }).catch(() => { /* ignore */ });
        return () => { cancelled = true; };
    }, [checkStoredKeyAvailable]);

    // Dismiss each operation's success state and close its modal after 2.5s.
    // Each timer only resets its own operation, so two that finish close
    // together don't cancel each other's dismissal.
    useDismissAfterSuccess(transferSuccess, () => {
        setTransferHiveVisible(false);
        setTransferHbdVisible(false);
        setTransferPrefill(null);
        resetOperationSuccess('transfer');
    });
    useDismissAfterSuccess(powerUpSuccess, () => {
        setPowerUpVisible(false);
        resetOperationSuccess('powerUp');
    });
    useDismissAfterSuccess(powerDownSuccess, () => {
        setPowerDownVisible(false);
        resetOperationSuccess('powerDown');
    });
    useDismissAfterSuccess(savingsSuccess, () => {
        setSavingsMode(null);
        setWithdrawalToCancel(null);
        resetOperationSuccess('savings');
    });
    useDismissAfterSuccess(marketSuccess, () => {
        setMarketMode(null);
        resetOperationSuccess('market');
    });
    useDismissAfterSuccess(delegateSuccess, () => {
        setDelegateVisible(false);
        setDelegationToEdit(null);
        resetOperationSuccess('delegate');
    });

    /** Drops a cancelled biometric prompt silently; any other error goes back to the modal. */
    const ignoreAuthCancel = async (op: () => Promise<unknown>): Promise<void> => {
        try {
            await op();
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            throw err;
        }
    };

    const handleSavings = (mode: SavingsMode, amount: string, currency: 'HIVE' | 'HBD', manualKey?: string): Promise<void> =>
        ignoreAuthCancel(() =>
            // 'collect' is a token HBD deposit that triggers the interest payout.
            mode === 'withdraw'
                ? withdrawFromSavings(amount, currency, manualKey)
                : depositToSavings(amount, currency, manualKey)
        );

    const handleCancelWithdrawal = (requestId: number, manualKey?: string): Promise<void> =>
        ignoreAuthCancel(() => cancelSavingsWithdraw(requestId, manualKey));

    const handleDelegate = (delegatee: string, amountHp: string, manualKey?: string): Promise<void> => {
        if (!globalProps) return Promise.reject(new Error('Wallet data not loaded. Please wait and try again.'));
        return ignoreAuthCancel(() => delegate(delegatee, amountHp, globalProps, manualKey));
    };

    const handleClaim = async (): Promise<void> => {
        if (!pendingRewards) return;
        try {
            await claimRewards(pendingRewards);
        } catch (err) {
            Alert.alert('Couldn\u2019t claim rewards', err instanceof Error ? err.message : 'Please try again.');
        }
    };

    const openSavings = (mode: SavingsMode, currency: 'HIVE' | 'HBD' = 'HBD'): void => {
        setSavingsCurrency(currency);
        setSavingsMode(mode);
    };

    const openDelegate = (existing: OutgoingDelegation | null): void => {
        setDelegationToEdit(existing);
        setDelegateVisible(true);
    };

    const handleTransfer = async (currency: 'HIVE' | 'HBD', to: string, amount: string, memo: string, manualKey?: string): Promise<void> => {
        try {
            await transfer(to, amount, currency, memo, manualKey);
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            throw err; // re-throw so modal shows the error
        }
    };

    const handlePowerUp = async (amount: string, manualKey?: string): Promise<void> => {
        try {
            await powerUp(amount, manualKey);
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            throw err;
        }
    };

    const handlePowerDown = async (amountHp: string, manualKey?: string): Promise<void> => {
        if (!globalProps) throw new Error('Wallet data not loaded. Please wait and try again.');
        try {
            await powerDown(amountHp, globalProps, manualKey);
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            throw err;
        }
    };

    const handleCancelPowerDown = async (manualKey?: string): Promise<void> => {
        try {
            await cancelPowerDown(manualKey);
        } catch (err) {
            if (err instanceof AuthCancelledError) return;
            throw err;
        }
    };

    // A scanned payment-request QR opens the matching Transfer modal
    // pre-filled, rather than sending immediately — the scanner still
    // reviews (and can edit) the recipient/amount/memo before confirming.
    const handleScanned = (data: HiveTransferQRData): void => {
        setScanPaymentVisible(false);
        const currency = currencyFromAmount(data.amount);
        setTransferPrefill({ to: data.to, amount: String(valueFromAmount(data.amount)), memo: data.memo });
        if (currency === 'HBD') setTransferHbdVisible(true);
        else setTransferHiveVisible(true);
    };

    const actions = [
        {
            label: 'Transfer\nHIVE',
            icon: 'send' as const,
            onPress: () => setTransferHiveVisible(true),
        },
        {
            label: 'Transfer\nHBD',
            icon: 'send-o' as const,
            onPress: () => setTransferHbdVisible(true),
        },
        {
            label: 'Power\nUp',
            icon: 'arrow-circle-up' as const,
            onPress: () => setPowerUpVisible(true),
        },
        {
            label: 'Power\nDown',
            icon: 'arrow-circle-down' as const,
            onPress: () => setPowerDownVisible(true),
        },
        {
            label: 'Delegate\nHP',
            icon: 'handshake-o' as const,
            onPress: () => openDelegate(null),
        },
        {
            label: 'HBD\nSavings',
            icon: 'bank' as const,
            onPress: () => openSavings('deposit', 'HBD'),
        },
        {
            label: 'Swap\nHIVE/HBD',
            icon: 'exchange' as const,
            onPress: () => setMarketMode('swap'),
        },
        {
            label: 'Convert\nHBD',
            icon: 'hourglass-half' as const,
            onPress: () => setMarketMode('convert'),
        },
        {
            label: 'Request\nPayment',
            icon: 'qrcode' as const,
            onPress: () => setRequestPaymentVisible(true),
        },
        {
            label: 'Scan to\nPay',
            icon: 'camera' as const,
            onPress: () => setScanPaymentVisible(true),
        },
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <FontAwesome name="arrow-left" size={18} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Wallet</Text>
                {refreshing && <ActivityIndicator size="small" color={theme.icon} style={{ marginLeft: 'auto' }} />}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.icon} />
                    <Text style={styles.loadingText}>Loading wallet...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {/* Pending rewards — claim straight from the wallet */}
                    {showRewards && pendingRewards && (
                        <View style={{ marginHorizontal: -12, marginTop: -8, marginBottom: 16 }}>
                            <PendingRewardsBanner
                                rewards={pendingRewards}
                                onPress={handleClaim}
                                ctaLabel="Claim"
                                actionHint="Tap to claim them into your wallet."
                                loading={claimLoading}
                                accessory={<TermInfo term="pendingRewards" color={theme.textSecondary} size={15} />}
                            />
                        </View>
                    )}

                    {/* Balance card */}
                    {walletData && (
                        <View style={styles.balanceCard}>
                            <Text style={styles.balanceCardTitle}>Balances</Text>
                            <View style={styles.balanceRow}>
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{walletData.hiveBalance.toFixed(3)}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.balanceLabel}>HIVE</Text>
                                        <TermInfo term="hive" color={theme.textSecondary} size={12} />
                                    </View>
                                </View>
                                <View style={styles.balanceDivider} />
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{walletData.hbdBalance.toFixed(3)}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.balanceLabel}>HBD</Text>
                                        <TermInfo term="hbd" color={theme.textSecondary} size={12} />
                                    </View>
                                </View>
                                <View style={styles.balanceDivider} />
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{walletData.hivePower.toFixed(3)}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.balanceLabel}>HP</Text>
                                        <TermInfo term="hp" color={theme.textSecondary} size={12} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Active power down status */}
                    {walletData && walletData.activePowerDownRate > 0 && (
                        <View style={styles.powerDownCard}>
                            <View style={styles.powerDownCardHeader}>
                                <FontAwesome name="refresh" size={13} color={theme.icon} />
                                <Text style={styles.powerDownCardTitle}>Power Down Active</Text>
                            </View>
                            <Text style={styles.powerDownCardText}>
                                {walletData.activePowerDownRate.toFixed(3)} HP per week
                            </Text>
                        </View>
                    )}

                    {walletData && (
                        <SavingsCard
                            colors={colors}
                            savingsHive={walletData.savingsHive}
                            savingsHbd={walletData.savingsHbd}
                            hbdInterestRate={walletData.hbdInterestRate}
                            pendingHbdInterest={walletData.pendingHbdInterest}
                            nextInterestPayout={walletData.nextInterestPayout}
                            withdrawals={withdrawals}
                            loadFailed={extrasFailed}
                            onRetry={retryExtras}
                            canCollectInterest={canCollectHbdInterest(walletData)}
                            onCollectInterest={() => openSavings('collect', 'HBD')}
                            onDeposit={() => openSavings('deposit')}
                            onWithdraw={() => openSavings('withdraw', walletData.savingsHbd > 0 ? 'HBD' : 'HIVE')}
                            onCancelWithdrawal={setWithdrawalToCancel}
                        />
                    )}

                    {walletData && (
                        <DelegationsCard
                            colors={colors}
                            delegations={delegations}
                            loadFailed={extrasFailed}
                            onRetry={retryExtras}
                            receivedHivePower={walletData.receivedHivePower}
                            onAdd={() => openDelegate(null)}
                            onEdit={openDelegate}
                        />
                    )}

                    {/* Action grid */}
                    <Text style={styles.sectionTitle}>Actions</Text>
                    <View style={styles.actionsGrid}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                style={styles.actionCard}
                                onPress={action.onPress}
                                accessibilityRole="button"
                            >
                                <View style={styles.actionIconWrap}>
                                    <FontAwesome name={action.icon} size={20} color={theme.icon} />
                                </View>
                                <Text style={styles.actionLabel}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* The Pile market — buy items to throw from any snap */}
                    <PileMarketSection currentUsername={currentUsername} colors={colors} />

                    {/* Recent transactions */}
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <TransactionList
                        transactions={transactions}
                        loading={historyLoading}
                        error={historyError}
                        colors={colors}
                    />
                </ScrollView>
            )}

            {/* Transfer HIVE */}
            <TransferModal
                visible={transferHiveVisible}
                currency="HIVE"
                balance={walletData?.hiveBalance ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={transferLoading}
                success={transferSuccess}
                colors={colors}
                initialTo={transferPrefill?.to}
                initialAmount={transferPrefill?.amount}
                initialMemo={transferPrefill?.memo}
                onClose={() => { setTransferHiveVisible(false); setTransferPrefill(null); }}
                onTransfer={(to, amount, memo, manualKey) => handleTransfer('HIVE', to, amount, memo, manualKey)}
            />

            {/* Transfer HBD */}
            <TransferModal
                visible={transferHbdVisible}
                currency="HBD"
                balance={walletData?.hbdBalance ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={transferLoading}
                success={transferSuccess}
                colors={colors}
                initialTo={transferPrefill?.to}
                initialAmount={transferPrefill?.amount}
                initialMemo={transferPrefill?.memo}
                onClose={() => { setTransferHbdVisible(false); setTransferPrefill(null); }}
                onTransfer={(to, amount, memo, manualKey) => handleTransfer('HBD', to, amount, memo, manualKey)}
            />

            {/* Power Up */}
            <PowerUpModal
                visible={powerUpVisible}
                hiveBalance={walletData?.hiveBalance ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={powerUpLoading}
                success={powerUpSuccess}
                colors={colors}
                onClose={() => setPowerUpVisible(false)}
                onPowerUp={handlePowerUp}
            />

            {/* Power Down */}
            <PowerDownModal
                visible={powerDownVisible}
                ownHivePower={walletData?.ownHivePower ?? 0}
                activePowerDownRate={walletData?.activePowerDownRate ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={powerDownLoading}
                success={powerDownSuccess}
                colors={colors}
                onClose={() => setPowerDownVisible(false)}
                onPowerDown={handlePowerDown}
                onCancelPowerDown={handleCancelPowerDown}
            />

            {/* Swap HIVE ⇄ HBD / Convert HBD → HIVE */}
            <MarketModal
                visible={marketMode !== null}
                mode={marketMode ?? 'swap'}
                balances={{ HIVE: walletData?.hiveBalance ?? 0, HBD: walletData?.hbdBalance ?? 0 }}
                hasStoredKey={storedKeyAvailable}
                loading={marketLoading}
                success={marketSuccess}
                colors={colors}
                onClose={() => setMarketMode(null)}
                onSwap={(direction, amount, min, manualKey) => ignoreAuthCancel(() => swap(direction, amount, min, manualKey))}
                onConvert={(amount, manualKey) => ignoreAuthCancel(() => convertHbd(amount, manualKey))}
            />

            {/* Savings deposit / withdraw */}
            <SavingsModal
                visible={savingsMode !== null}
                mode={savingsMode ?? 'deposit'}
                initialCurrency={savingsCurrency}
                liquid={{ HIVE: walletData?.hiveBalance ?? 0, HBD: walletData?.hbdBalance ?? 0 }}
                savings={{ HIVE: walletData?.savingsHive ?? 0, HBD: walletData?.savingsHbd ?? 0 }}
                hbdInterestRate={walletData?.hbdInterestRate ?? 0}
                pendingHbdInterest={walletData?.pendingHbdInterest ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={savingsLoading && savingsMode !== null}
                success={savingsSuccess && savingsMode !== null}
                colors={colors}
                onClose={() => setSavingsMode(null)}
                onSubmit={handleSavings}
            />

            {/* Cancel a pending savings withdrawal */}
            <CancelWithdrawModal
                withdrawal={withdrawalToCancel}
                hasStoredKey={storedKeyAvailable}
                loading={savingsLoading && withdrawalToCancel !== null}
                success={savingsSuccess && withdrawalToCancel !== null}
                colors={colors}
                onClose={() => setWithdrawalToCancel(null)}
                onConfirm={handleCancelWithdrawal}
            />

            {/* Delegate HP (new or edit/remove) */}
            <DelegateModal
                visible={delegateVisible}
                existing={delegationToEdit ? { delegatee: delegationToEdit.delegatee, hp: delegationToEdit.hp } : null}
                delegatableHivePower={walletData?.delegatableHivePower ?? 0}
                hasStoredKey={storedKeyAvailable}
                loading={delegateLoading}
                success={delegateSuccess}
                colors={colors}
                onClose={() => { setDelegateVisible(false); setDelegationToEdit(null); }}
                onDelegate={handleDelegate}
            />

            {/* Request Payment (QR) */}
            {currentUsername && (
                <RequestPaymentModal
                    visible={requestPaymentVisible}
                    username={currentUsername}
                    colors={colors}
                    onClose={() => setRequestPaymentVisible(false)}
                />
            )}

            {/* Scan to Pay */}
            <ScanPaymentModal
                visible={scanPaymentVisible}
                colors={colors}
                onClose={() => setScanPaymentVisible(false)}
                onScanned={handleScanned}
            />
        </SafeAreaView>
    );
};

export default WalletScreen;
