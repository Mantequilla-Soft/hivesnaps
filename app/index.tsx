import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { accountStorageService } from '../services/AccountStorageService';
import { useAppStore } from '../store/context';
import { useAuth } from '../hooks/useAuth';
import { getTheme } from '../constants/Colors';
import LoginScreen from './screens/LoginScreen';

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function Index() {
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme() || 'light';
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const { setCurrentUser, setHasActiveKey } = useAppStore();
  const { authenticate } = useAuth();

  useEffect(() => {
    // This screen can mount, unmount and mount again during launch; a run
    // whose screen is gone must not sign in or navigate (two parallel
    // sign-ins made the backend reject one, #262).
    let cancelled = false;
    const determineInitialRoute = async (): Promise<void> => {
      try {
        // Check for legacy (v1) account before triggering auto-migration.
        // If found, show the migration screen so the user understands the upgrade.
        const hasLegacy = await accountStorageService.hasLegacyAccount();
        if (cancelled) return;
        if (hasLegacy) {
          router.replace('/screens/MigrationScreen' as never);
          return;
        }

        // No legacy account — check the new multi-account storage.
        const accounts = await accountStorageService.getAccounts();
        if (cancelled) return;
        if (accounts.length === 0) {
          // No accounts stored — show login screen.
          setInitializing(false);
          return;
        }

        const username = await accountStorageService.getCurrentAccountUsername();
        if (cancelled) return;
        if (!username) {
          // Accounts exist but none is selected — let the user pick.
          router.replace('/screens/AccountSelectionScreen' as never);
          return;
        }

        const keys = await accountStorageService.getAccountKeys(username);
        if (cancelled) return;
        if (!keys) {
          // Current account has no keys — fall back to login.
          setInitializing(false);
          return;
        }

        // Auto-login: keys were validated against blockchain when first stored.
        setCurrentUser(username);
        setHasActiveKey(!!keys.activeKey);

        const jwtSuccess = await authenticate(username, keys.postingKey);
        if (cancelled) return;
        if (!jwtSuccess) {
          console.warn('[Init] JWT auth failed, continuing without token');
        }

        router.replace('/screens/FeedScreen');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unknown initialization error';
        if (__DEV__) {
          console.error('[Init] Error determining initial route:', message);
        }
        setInitializing(false);
      }
    };

    determineInitialRoute();
    return () => {
      cancelled = true;
    };
  }, [router, setCurrentUser, setHasActiveKey, authenticate]);

  if (initializing) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.button} />
      </View>
    );
  }

  return <LoginScreen />;
}
