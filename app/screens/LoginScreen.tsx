import {
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/context';
import { getTheme, palette } from '../../constants/Colors';
import { accountStorageService } from '../../services/AccountStorageService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_WIDTH = SCREEN_WIDTH * 0.8;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLoading, setAutoLoading] = useState(true); // New state for auto-login loading
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    inputBg: theme.bubble,
    inputBorder: theme.inputBorder,
    button: theme.button,
    buttonText: theme.buttonText,
    info: theme.textSecondary,
    footer: isDark ? theme.border : palette.lightTabIcon,
  };
  const router = useRouter();
  const { authenticate } = useAuth();
  const { setCurrentUser, setHasActiveKey } = useAppStore();

  // Auto-login functionality
  useEffect(() => {
    const checkStoredCredentials = async () => {
      try {
        // getAccounts() triggers legacy migration so hive_current_account is populated
        await accountStorageService.getAccounts();
        const storedUsername = await accountStorageService.getCurrentAccountUsername();
        if (storedUsername) {
          const keys = await accountStorageService.getAccountKeys(storedUsername);
          if (keys) {
            // Keys were validated against blockchain when first stored — skip re-validation
            const jwtSuccess = await authenticate(storedUsername, keys.postingKey);
            if (!jwtSuccess) {
              console.warn('[Auto-login] JWT authentication failed, continuing without token');
            }
            setCurrentUser(storedUsername);
            setHasActiveKey(!!keys.activeKey);
            router.push('/screens/FeedScreen');
            return;
          }
        }
      } catch (error) {
        console.error('[Auto-login] Failed:', error);
      } finally {
        setAutoLoading(false);
      }
    };

    checkStoredCredentials();
  }, [router]);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Use a test posting key for the username 'appstoret' for easier testing
      const testPostingKey = '5K4xkL1sdkqV5NFHQDtx61gVGcXqZRNDAHVFLbQbQ5W96Vy8cDy';
      const cleanUsername = username.trim().replace(/^@/, '');
      const postingWif = cleanUsername !== 'appstoret' ? postingKey.trim() : testPostingKey;

      // Step 1: Store account (validates posting key against blockchain internally)
      // Fetch existing keys first to preserve any stored active key
      const existingKeys = await accountStorageService.getAccountKeys(cleanUsername);
      await accountStorageService.addAccount(cleanUsername, postingWif, existingKeys?.activeKey);
      await accountStorageService.setCurrentAccountUsername(cleanUsername);

      // Step 2: Update app store
      setCurrentUser(cleanUsername);
      setHasActiveKey(!!existingKeys?.activeKey);

      // Step 3: Get JWT token via challenge-response authentication
      const jwtSuccess = await authenticate(cleanUsername, postingWif);
      if (!jwtSuccess) {
        console.warn('[Login] JWT authentication failed, continuing without token');
        setError('Login successful, but some features may be limited. Please try again later.');
      }

      // Step 4: Navigate to feed screen
      setLoading(false);
      router.push('/screens/FeedScreen');
    } catch (e: unknown) {
      setLoading(false);
      setError(
        e instanceof Error
          ? e.message
          : 'Login failed. Please try again.',
      );
    }
  };

  const handleLearnMorePress = () => {
    Linking.openURL('https://hive.io/');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {autoLoading ? (
        // Show loading screen during auto-login check
        <View style={[styles.flexContainer, styles.loadingContainer]}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode='contain'
          />
          <ActivityIndicator
            size='large'
            color={colors.button}
            style={{ marginTop: 24 }}
          />
          <Text style={[styles.loadingText, { color: colors.info }]}>
            Checking credentials...
          </Text>
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View style={styles.flexContainer}>
              <View style={styles.innerContainer}>
                {/* App logo at the top */}
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logo}
                  resizeMode='contain'
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      width: FIELD_WIDTH,
                    },
                  ]}
                  placeholder='username'
                  placeholderTextColor={
                    colorScheme === 'dark' ? '#8899A6' : '#536471'
                  }
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize='none'
                  autoCorrect={false}
                  editable={!loading}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      width: FIELD_WIDTH,
                    },
                  ]}
                  placeholder='Posting key only'
                  placeholderTextColor={
                    colorScheme === 'dark' ? '#8899A6' : '#536471'
                  }
                  value={postingKey}
                  onChangeText={setPostingKey}
                  secureTextEntry
                  autoCapitalize='none'
                  autoCorrect={false}
                  editable={!loading}
                />
                {error ? (
                  <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: colors.button,
                      width: FIELD_WIDTH,
                      opacity: loading ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text
                      style={[styles.buttonText, { color: colors.buttonText }]}
                    >
                      Login
                    </Text>
                  )}
                </TouchableOpacity>
                <Text
                  style={[
                    styles.info,
                    { color: colors.text, width: FIELD_WIDTH },
                  ]}
                >
                  Your keys are locally stored and encrypted. Only your posting
                  key is required
                </Text>
                {/* Add space and move the phrase up here */}
                <View style={{ height: 32 }} />

                {/* Learn more link */}
                <TouchableOpacity
                  onPress={handleLearnMorePress}
                  style={{ marginBottom: 16 }}
                  accessibilityRole='button'
                  accessibilityLabel='Learn more about Hive'
                >
                  <Text style={[styles.signupLink, { color: colors.button }]}>
                    Learn more at hive.io
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.footerText, { color: colors.footer }]}>
                  Hivesnaps, made with love by @meno
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flexContainer: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    alignSelf: 'center',
  },
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  info: {
    marginTop: 18,
    fontSize: 14,
    textAlign: 'center',
    alignSelf: 'center',
  },
  signupLink: {
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  footerText: {
    fontSize: 13,
    color: palette.lightTabIcon, // fallback, will be overridden inline
    textAlign: 'center',
    width: '100%',
  },
});
