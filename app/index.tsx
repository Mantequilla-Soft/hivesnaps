import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { accountStorageService } from '../services/AccountStorageService';
import { useAppStore } from '../store/context';
import { useAuth } from '../hooks/useAuth';
import { getTheme } from '../constants/Colors';
import LoginScreen from './screens/LoginScreen';

export default function Index() {
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme() || 'light';
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const { setCurrentUser, setHasActiveKey } = useAppStore();
  const { authenticate } = useAuth();

  useEffect(() => {
    determineInitialRoute();
  }, []);

  const determineInitialRoute = async () => {
    try {
      // Check for legacy (v1) account before triggering auto-migration.
      // If found, show the migration screen so the user understands the upgrade.
      const hasLegacy = await accountStorageService.hasLegacyAccount();
      if (hasLegacy) {
        router.replace('/screens/MigrationScreen' as never);
        return;
      }

      // No legacy account — check the new multi-account storage.
      const accounts = await accountStorageService.getAccounts();
      if (accounts.length === 0) {
        // No accounts stored — show login screen.
        setInitializing(false);
        return;
      }

      const username = await accountStorageService.getCurrentAccountUsername();
      if (!username) {
        // Accounts exist but none is selected — let the user pick.
        router.replace('/screens/AccountSelectionScreen' as never);
        return;
      }

      const keys = await accountStorageService.getAccountKeys(username);
      if (!keys) {
        // Current account has no keys — fall back to login.
        setInitializing(false);
        return;
      }

      // Auto-login: keys were validated against blockchain when first stored.
      setCurrentUser(username);
      setHasActiveKey(!!keys.activeKey);

      const jwtSuccess = await authenticate(username, keys.postingKey);
      if (!jwtSuccess) {
        console.warn('[Init] JWT auth failed, continuing without token');
      }

      router.replace('/screens/FeedScreen');
    } catch (error) {
      console.error('[Init] Error determining initial route:', error);
      setInitializing(false);
    }
  };

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.button} />
      </View>
    );
  }

  return <LoginScreen />;
}
