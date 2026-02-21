import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountStorageService } from '../services/AccountStorageService';
import { SessionService } from '../services/SessionService';
import { useAppStore } from '../store/context';
import { getTheme } from '../constants/Colors';
import LoginScreen from './screens/LoginScreen';

export default function Index() {
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme() || 'light';
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const { setCurrentUser, setHasActiveKey } = useAppStore();

  useEffect(() => {
    determineInitialRoute();
  }, []);

  const determineInitialRoute = async () => {
    try {
      // Check for legacy account (needs migration)
      const hasLegacy = await AccountStorageService.hasLegacyAccount();
      if (hasLegacy) {
        console.log('[Init] Legacy account found, navigating to migration');
        router.replace('/screens/MigrationScreen' as any);
        return;
      }

      // Check for new multi-account system
      const hasAccounts = await AccountStorageService.hasAccounts();

      if (!hasAccounts) {
        // No accounts - show login screen
        console.log('[Init] No accounts found, staying on login screen');
        setInitializing(false);
        return;
      }

      // Has accounts - check if session is valid
      if (SessionService.isSessionValid()) {
        const sessionUsername = SessionService.getCurrentUsername();
        const hasActive = SessionService.hasActiveKey();
        console.log('[Init] Valid session found for user:', sessionUsername);

        // Restore user state from session
        if (sessionUsername) {
          setCurrentUser(sessionUsername);
          setHasActiveKey(hasActive);
        }

        router.replace('/screens/FeedScreen');
      } else {
        console.log('[Init] Session expired, navigating to account selection');
        router.replace('/screens/AccountSelectionScreen' as any);
      }
    } catch (error) {
      console.error('[Init] Error determining initial route:', error);
      // On error, show login screen
      setInitializing(false);
    }
  };

  // Show loading indicator while determining route
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

  // Render login screen as default
  return <LoginScreen />;
}
