import {
    FlatList,
    TouchableOpacity,
    useColorScheme,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter } from 'expo-router';
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { AccountStorageService, StoredAccount } from '../../services/AccountStorageService';
import { useAvatar } from '../../hooks/useAvatar';
import { createAccountSelectionScreenStyles } from '../../styles/AccountSelectionScreenStyles';

interface AccountItemProps {
    account: StoredAccount;
    onSelect: (username: string) => void;
    onLongPress: (username: string) => void;
    isDark: boolean;
    styles: ReturnType<typeof createAccountSelectionScreenStyles>;
}

function AccountItem({ account, onSelect, onLongPress, isDark, styles }: AccountItemProps) {
    const theme = getTheme(isDark ? 'dark' : 'light');
    const { avatarUrl } = useAvatar(account.username);
    const hasActiveKey = !!(account.encryptedActiveKey && account.activeSalt && account.activeIv);

    return (
        <TouchableOpacity
            style={styles.accountItem}
            onPress={() => onSelect(account.username)}
            onLongPress={() => onLongPress(account.username)}
            activeOpacity={0.7}
        >
            {/* Avatar */}
            <Image
                source={{ uri: avatarUrl || 'https://images.ecency.com/u/hive-default/avatar' }}
                style={styles.avatar}
            />

            {/* Account Info */}
            <View style={styles.accountInfo}>
                <Text style={styles.username}>
                    @{account.username}
                </Text>
                <View style={styles.badgeContainer}>
                    {hasActiveKey ? (
                        <View style={[styles.badge, { backgroundColor: palette.success + '20', borderColor: palette.success }]}>
                            <Ionicons name="shield-checkmark" size={12} color={palette.success} />
                            <Text style={[styles.badgeText, { color: palette.success }]}>Full Access</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, { backgroundColor: palette.primary + '20', borderColor: palette.primary }]}>
                            <Ionicons name="create-outline" size={12} color={palette.primary} />
                            <Text style={[styles.badgeText, { color: palette.primary }]}>Posting Only</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Arrow */}
            <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
    );
}

export default function AccountSelectionScreen() {
    const [accounts, setAccounts] = useState<StoredAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark ? 'dark' : 'light');
    const router = useRouter();

    const styles = createAccountSelectionScreenStyles(isDark);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const storedAccounts = await AccountStorageService.getAccounts();
            // Sort by lastUsed (most recent first)
            const sorted = storedAccounts.sort((a, b) => b.lastUsed - a.lastUsed);
            setAccounts(sorted);
        } catch (error) {
            console.error('Error loading accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAccount = (username: string) => {
        // Always proceed to PIN entry - no shortcuts
        router.push({
            pathname: '/screens/PinEntryScreen' as any,
            params: { mode: 'unlock', username },
        });
    };

    const handleLongPressAccount = (username: string) => {
        Alert.alert(
            'Manage Account',
            `@${username}`,
            [
                {
                    text: 'Add Active Key',
                    onPress: () => router.push({
                        pathname: '/screens/AddActiveKeyScreen' as any,
                        params: { username },
                    }),
                },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: () => handleDeleteAccount(username),
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleDeleteAccount = (username: string) => {
        Alert.alert(
            'Delete Account',
            `Are you sure you want to remove @${username}? You'll need to re-enter your posting key to add it again.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AccountStorageService.removeAccount(username);
                            await loadAccounts();

                            // If no accounts left, go to login
                            const remainingAccounts = await AccountStorageService.getAccounts();
                            if (remainingAccounts.length === 0) {
                                router.replace('/screens/LoginScreen');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete account');
                        }
                    },
                },
            ]
        );
    };

    const handleAddAccount = () => {
        router.push('/screens/LoginScreen');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading accounts...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Select Account</Text>
                <Text style={styles.subtitle}>
                    Choose an account to unlock
                </Text>
            </View>

            <FlatList
                data={accounts}
                keyExtractor={(item) => item.username}
                renderItem={({ item }) => (
                    <AccountItem
                        account={item}
                        onSelect={handleSelectAccount}
                        onLongPress={handleLongPressAccount}
                        isDark={isDark}
                        styles={styles}
                    />
                )}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="person-add-outline" size={64} color={theme.textSecondary} />
                        <Text style={styles.emptyText}>
                            No accounts added yet
                        </Text>
                    </View>
                }
                ListHeaderComponent={
                    accounts.length > 0 ? (
                        <Text style={styles.helpText}>
                            Long press an account to manage or delete it
                        </Text>
                    ) : null
                }
                ListFooterComponent={
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddAccount}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={24} color={theme.buttonText} />
                        <Text style={styles.addButtonText}>
                            Add Another Account
                        </Text>
                    </TouchableOpacity>
                }
            />
        </SafeAreaView>
    );
}
