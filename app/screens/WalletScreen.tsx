import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTheme } from '../../constants/Colors';
import { getClient } from '../../services/HiveClient';
import { useAuth } from '../../store/context';
import { createWalletScreenStyles } from '../../styles/WalletScreenStyles';
import { vestsToHp } from '../../utils/hiveCalculations';
import { useWalletOperations } from '../../hooks/useWalletOperations';
import { TransferModal } from '../components/wallet/TransferModal';
import { PowerUpModal } from '../components/wallet/PowerUpModal';
import { PowerDownModal } from '../components/wallet/PowerDownModal';
import { AuthCancelledError } from '../../services/LocalAuthService';

const client = getClient();

interface WalletData {
    hiveBalance: number;
    hbdBalance: number;
    hivePower: number;       // effective HP (own + received delegations)
    ownHivePower: number;    // own HP only (powerdown-able)
    activePowerDownRate: number; // weekly HP payout, 0 = inactive
}

const WalletScreen = (): React.JSX.Element => {
    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const router = useRouter();
    const { currentUsername } = useAuth();

    const theme = getTheme(isDark ? 'dark' : 'light');
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
    };

    // Wallet data state
    const [walletData, setWalletData] = useState<WalletData | null>(null);
    const [globalProps, setGlobalProps] = useState<{ total_vesting_fund_hive: string; total_vesting_shares: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal visibility
    const [transferHiveVisible, setTransferHiveVisible] = useState(false);
    const [transferHbdVisible, setTransferHbdVisible] = useState(false);
    const [powerUpVisible, setPowerUpVisible] = useState(false);
    const [powerDownVisible, setPowerDownVisible] = useState(false);

    // Stored key availability (checked once on mount)
    const [storedKeyAvailable, setStoredKeyAvailable] = useState(false);

    const {
        transferLoading, transferSuccess,
        powerUpLoading, powerUpSuccess,
        powerDownLoading, powerDownSuccess,
        transfer, powerUp, powerDown, cancelPowerDown,
        checkStoredKeyAvailable,
    } = useWalletOperations(currentUsername, async () => { await fetchWalletData(true); });

    const fetchWalletData = useCallback(async (silent = false): Promise<void> => {
        if (!currentUsername) return;
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const [accounts, props] = await Promise.all([
                client.database.call('get_accounts', [[currentUsername]]),
                client.database.getDynamicGlobalProperties(),
            ]);
            if (!accounts || !accounts[0]) throw new Error('Account not found');
            const account = accounts[0];

            const gProps = {
                total_vesting_fund_hive: props.total_vesting_fund_hive?.toString() ?? '0 HIVE',
                total_vesting_shares: props.total_vesting_shares?.toString() ?? '0 VESTS',
            };
            setGlobalProps(gProps);

            const hiveBalance = parseFloat((account.balance || '0.000 HIVE').replace(' HIVE', ''));
            const hbdBalance = parseFloat((account.hbd_balance || '0.000 HBD').replace(' HBD', ''));
            const vestingShares = parseFloat((account.vesting_shares || '0.000000 VESTS').replace(' VESTS', ''));
            const delegatedVests = parseFloat((account.delegated_vesting_shares || '0.000000 VESTS').replace(' VESTS', ''));
            const receivedVests = parseFloat((account.received_vesting_shares || '0.000000 VESTS').replace(' VESTS', ''));
            const withdrawRate = parseFloat((account.vesting_withdraw_rate || '0.000000 VESTS').replace(' VESTS', ''));

            const effectiveVests = vestingShares - delegatedVests + receivedVests;
            const ownVests = vestingShares - delegatedVests;

            const hivePower = vestsToHp(effectiveVests, gProps.total_vesting_fund_hive, gProps.total_vesting_shares);
            const ownHivePower = vestsToHp(ownVests, gProps.total_vesting_fund_hive, gProps.total_vesting_shares);
            const activePowerDownRate = vestsToHp(withdrawRate, gProps.total_vesting_fund_hive, gProps.total_vesting_shares);

            setWalletData({ hiveBalance, hbdBalance, hivePower, ownHivePower, activePowerDownRate });
        } catch (err) {
            if (!silent) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load wallet');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentUsername]);

    useEffect(() => {
        fetchWalletData();
        checkStoredKeyAvailable().then(setStoredKeyAvailable);
    }, [fetchWalletData, checkStoredKeyAvailable]);

    // Dismiss success state and close modal after 2.5s
    useEffect(() => {
        if (transferSuccess) setTimeout(() => { setTransferHiveVisible(false); setTransferHbdVisible(false); }, 2500);
    }, [transferSuccess]);

    useEffect(() => {
        if (powerUpSuccess) setTimeout(() => setPowerUpVisible(false), 2500);
    }, [powerUpSuccess]);

    useEffect(() => {
        if (powerDownSuccess) setTimeout(() => setPowerDownVisible(false), 2500);
    }, [powerDownSuccess]);

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
        if (!globalProps) return;
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
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
                    {/* Balance card */}
                    {walletData && (
                        <View style={styles.balanceCard}>
                            <Text style={styles.balanceCardTitle}>Balances</Text>
                            <View style={styles.balanceRow}>
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue}>{walletData.hiveBalance.toFixed(3)}</Text>
                                    <Text style={styles.balanceLabel}>HIVE</Text>
                                </View>
                                <View style={styles.balanceDivider} />
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue}>{walletData.hbdBalance.toFixed(3)}</Text>
                                    <Text style={styles.balanceLabel}>HBD</Text>
                                </View>
                                <View style={styles.balanceDivider} />
                                <View style={styles.balanceItem}>
                                    <Text style={styles.balanceValue}>{walletData.hivePower.toFixed(3)}</Text>
                                    <Text style={styles.balanceLabel}>HP</Text>
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
                onClose={() => setTransferHiveVisible(false)}
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
                onClose={() => setTransferHbdVisible(false)}
                onTransfer={(to, amount, memo, manualKey) => handleTransfer('HBD', to, amount, memo, manualKey)}
            />

            {/* Power Up */}
            <PowerUpModal
                visible={powerUpVisible}
                hiveBalance={walletData?.hiveBalance ?? 0}
                globalProps={globalProps}
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
        </SafeAreaView>
    );
};

export default WalletScreen;
