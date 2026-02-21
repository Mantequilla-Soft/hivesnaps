// Polyfills must be imported first
import 'react-native-get-random-values';
import 'fast-text-encoding';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import 'react-native-reanimated';

import { useColorScheme } from '../components/useColorScheme';
import { HivePostPreviewProvider } from '../context/HivePostPreviewContext';
import { ShareProvider } from '../context/ShareContext';
import { AppProvider } from '../store/context';
import TOSWrapper from '../components/TOSWrapper';

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
    // Log navigation state and attempted route
    if (navigation && navigation.getState) {
      const state = navigation.getState();
      console.log('[Navigation State]', state);
      if (state && state.routes && state.routes.length > 0) {
        const lastRoute = state.routes[state.routes.length - 1];
        console.log('[Attempted Route]', lastRoute);
      }
    }
    console.log('[Router Params]', params);
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
                <Stack.Screen name='screens/AccountSelectionScreen' />
                <Stack.Screen name='screens/PinEntryScreen' />
                <Stack.Screen name='screens/MigrationScreen' />
                <Stack.Screen name='screens/AddActiveKeyScreen' />
                <Stack.Screen name='screens/FeedScreen' />
                <Stack.Screen name='screens/NotificationsScreen' />
                <Stack.Screen name='screens/ConversationScreen' />
                <Stack.Screen name='screens/HivePostScreen' />
                <Stack.Screen name='screens/ProfileScreen' />
                <Stack.Screen name='screens/ComposeScreen' />
                <Stack.Screen name='screens/DiscoveryScreen' />
                <Stack.Screen name='modal' options={{ presentation: 'modal' }} />
              </Stack>
            </TOSWrapper>
          </ThemeProvider>
        </HivePostPreviewProvider>
      </ShareProvider>
    </AppProvider>
  );
}
