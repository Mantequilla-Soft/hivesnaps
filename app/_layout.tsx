import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import 'react-native-reanimated';

import { useColorScheme } from '../components/useColorScheme';
import { HivePostPreviewProvider } from '../context/HivePostPreviewContext';
import { ShareProvider } from '../context/ShareContext';
import { AppProvider } from '../store/context';
import { useAuth } from '../hooks/useAuth';
import { onAuthorityMismatch } from '../utils/hiveAuthErrors';
import TOSWrapper from '../components/TOSWrapper';
import { PointsToast } from './components/points/PointsToast';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// export const unstable_settings = {
//   initialRouteName: 'LoginScreen',
// };

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  useEffect(() => {
    if (!__DEV__) return;
    // Log navigation state and attempted route (dev only)
    if (navigation && navigation.getState) {
      const state = navigation.getState();
      console.log('[Navigation State]', state);
      if (state && state.routes && state.routes.length > 0) {
        const lastRoute = state.routes[state.routes.length - 1];
        console.log('[Attempted Route]', lastRoute);
      }
    }
    // Redact auth tokens before logging
    const { livekitToken: _lkt, ...safeParams } = params as Record<string, string | string[]>;
    console.log('[Router Params]', safeParams);
  }, [navigation, params]);

  return (
    <AppProvider>
      <ShareProvider>
        <HivePostPreviewProvider>
          <ThemeProvider
            value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
          >
            <TOSWrapper>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name='screens/LoginScreen' />
                <Stack.Screen name='screens/FeedScreen' />
                <Stack.Screen name='screens/NotificationsScreen' />
                <Stack.Screen name='screens/ConversationScreen' />
                <Stack.Screen name='screens/HivePostScreen' />
                <Stack.Screen name='screens/ProfileScreen' />
                <Stack.Screen name='screens/ComposeScreen' />
                <Stack.Screen name='screens/DiscoveryScreen' />
                <Stack.Screen name='screens/AccountSelectionScreen' />
                <Stack.Screen name='screens/AddActiveKeyScreen' />
                <Stack.Screen name='screens/MigrationScreen' />
                <Stack.Screen name='screens/WalletScreen' />
                <Stack.Screen name='screens/ShortsScreen' />
                <Stack.Screen name='screens/HangoutsLobbyScreen' />
                <Stack.Screen name='screens/HangoutsRoomScreen' />
                <Stack.Screen name='screens/PointsLeaderboardScreen' />
                <Stack.Screen name='modal' options={{ presentation: 'modal' }} />
              </Stack>
              <PointsToast />
              <StaleKeyWatcher />
            </TOSWrapper>
          </ThemeProvider>
        </HivePostPreviewProvider>
      </ShareProvider>
    </AppProvider>
  );
}

/**
 * Rendered once, inside AppProvider (useAuth needs its context) — listens
 * for a broadcast anywhere in the app failing because the stored key no
 * longer matches the account's on-chain authority (see
 * utils/hiveAuthErrors.ts), e.g. the user rotated their posting/active key
 * with another app. There's no fixing that locally, so this logs the user
 * out and routes back through app/index.tsx's normal post-logout landing
 * (account selection or login) instead of leaving them stuck re-hitting
 * the same broadcast error indefinitely.
 */
function StaleKeyWatcher(): ReactElement | null {
  const router = useRouter();
  const { logout, currentUsername } = useAuth();
  // Tracks which account's mismatch this one-shot guard already handled, so
  // a later mismatch after logging into a different account (without this
  // always-mounted component remounting) still triggers a logout.
  const handledForRef = useRef<string | null>(null);
  const currentUsernameRef = useRef(currentUsername);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  useEffect(() => {
    return onAuthorityMismatch(account => {
      const activeAccount = currentUsernameRef.current;
      // The failing broadcast was signed for an account the user has since
      // switched away from — it's stale, not a mismatch for who's active now.
      if (account && activeAccount && account !== activeAccount) return;
      if (handledForRef.current === activeAccount) return; // one shot per account session
      handledForRef.current = activeAccount;

      logout()
        .then(() => {
          // '/' (not LoginScreen directly) — same target AccountSelectionScreen's
          // own logout flow uses. app/index.tsx's own routing logic then decides
          // between AccountSelectionScreen (other stored accounts remain) and
          // LoginScreen (none do), same as any other logout in this app.
          router.replace('/');
          Alert.alert(
            'Signed Out',
            "Your saved key no longer matches this account — it may have been changed in another app. Please log in again with your current key."
          );
        })
        .catch(err => {
          console.error('[StaleKeyWatcher] Logout after key mismatch failed:', err);
          handledForRef.current = null; // let the next mismatch retry the logout
          Alert.alert(
            'Sign Out Failed',
            'Your saved key no longer matches this account, and we could not sign you out automatically. Please close and reopen the app, then log in again.'
          );
        });
    });
  }, [logout, router]);

  return null;
}
