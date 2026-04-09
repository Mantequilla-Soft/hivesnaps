import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { accountStorageService, StoredAccount } from '../../services/AccountStorageService';
import { useAuth } from '../../hooks/useAuth';
import { createAccountSelectionScreenStyles } from '../../styles/AccountSelectionScreenStyles';
import { getTheme } from '../../constants/Colors';

function formatLastUsed(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function AccountSelectionScreen(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useMemo(() => createAccountSelectionScreenStyles(isDark), [isDark]);
  const theme = useMemo(() => getTheme(isDark ? 'dark' : 'light'), [isDark]);
  const router = useRouter();

  const { currentUsername, switchAccount, logout } = useAuth();
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const isSwitchingRef = useRef(false);
  const isMountedRef = useRef(true);

  const loadAccounts = useCallback(async (): Promise<void> => {
    try {
      const stored = await accountStorageService.getAccounts();
      if (isMountedRef.current) setAccounts(stored);
    } catch (error: unknown) {
      if (__DEV__) console.error('[AccountSelectionScreen] Failed to load accounts:', error instanceof Error ? error.name : 'UnknownError');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadAccounts();
    return () => { isMountedRef.current = false; };
  }, [loadAccounts]);

  const handleSwitch = useCallback(async (username: string): Promise<void> => {
    if (username === currentUsername || isSwitchingRef.current) return;
    isSwitchingRef.current = true;
    setSwitchingTo(username);
    try {
      await switchAccount(username);
      router.back();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not switch account. Please try again.';
      Alert.alert('Error', message);
    } finally {
      isSwitchingRef.current = false;
      setSwitchingTo(null);
    }
  }, [currentUsername, switchAccount, router]);

  const handleDelete = useCallback((account: StoredAccount): void => {
    Alert.alert(
      'Remove Account',
      `Remove @${account.username} from this device? Your keys will be deleted locally.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await accountStorageService.removeAccount(account.username);
              if (account.username === currentUsername) {
                // Removed the active account — clear auth state then go to login
                await logout();
                router.replace('/');
              } else {
                await loadAccounts();
              }
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Failed to remove account. Please try again.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  }, [currentUsername, loadAccounts, logout, router]);

  const renderAccount = useCallback(({ item }: { item: StoredAccount }): React.JSX.Element => {
    const isActive = item.username === currentUsername;
    const isSwitching = item.username === switchingTo;

    return (
      <TouchableOpacity
        style={[styles.accountRow, isActive && styles.accountRowActive]}
        onPress={isActive ? undefined : () => handleSwitch(item.username)}
        onLongPress={() => handleDelete(item)}
        disabled={isSwitching}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.username}${isActive ? ', current account' : ''}`}
        accessibilityHint={isActive ? 'Long press to remove this account.' : 'Tap to switch to this account. Long press to remove it.'}
        accessibilityState={{ selected: isActive, disabled: isSwitching }}
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.accountInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{item.username}</Text>
            {isActive && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.lastUsed}>{formatLastUsed(item.lastUsed)}</Text>
        </View>
        {isSwitching && (
          <View style={styles.switchingOverlay}>
            <ActivityIndicator size="small" color={theme.button} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [currentUsername, switchingTo, handleSwitch, handleDelete, styles, theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <FontAwesome name="arrow-left" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accounts</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={accounts}
        keyExtractor={(item) => item.username}
        renderItem={renderAccount}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addAccountButton}
          onPress={() => router.push('/screens/LoginScreen')}
        >
          <FontAwesome name="plus" size={16} color={theme.buttonText} />
          <Text style={styles.addAccountButtonText}>Add Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
