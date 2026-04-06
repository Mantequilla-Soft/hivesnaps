import React, { useEffect, useState, useCallback } from 'react';
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
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function AccountSelectionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createAccountSelectionScreenStyles(isDark);
  const theme = getTheme(isDark ? 'dark' : 'light');
  const router = useRouter();

  const { currentUsername, switchAccount } = useAuth();
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const stored = await accountStorageService.getAccounts();
    setAccounts(stored);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSwitch = useCallback(async (username: string) => {
    if (username === currentUsername || switchingTo) return;
    setSwitchingTo(username);
    try {
      await switchAccount(username);
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not switch account. Please try again.');
      setSwitchingTo(null);
    }
  }, [currentUsername, switchingTo, switchAccount, router]);

  const handleDelete = useCallback((account: StoredAccount) => {
    Alert.alert(
      'Remove Account',
      `Remove @${account.username} from this device? Your keys will be deleted locally.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await accountStorageService.removeAccount(account.username);
            if (account.username === currentUsername) {
              // Removed the active account — go back to login
              router.replace('/');
            } else {
              loadAccounts();
            }
          },
        },
      ]
    );
  }, [currentUsername, loadAccounts, router]);

  const renderAccount = useCallback(({ item }: { item: StoredAccount }) => {
    const isActive = item.username === currentUsername;
    const isSwitching = item.username === switchingTo;

    return (
      <TouchableOpacity
        style={[styles.accountRow, isActive && styles.accountRowActive]}
        onPress={() => handleSwitch(item.username)}
        onLongPress={() => handleDelete(item)}
        disabled={isActive || !!switchingTo}
        activeOpacity={0.7}
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
