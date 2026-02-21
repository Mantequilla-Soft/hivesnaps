import {
  StyleSheet,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as Linking from 'expo-linking';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/context';
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_WIDTH = SCREEN_WIDTH * 0.8;

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
  const { setCurrentUser } = useAppStore();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Clean username by removing @ symbol if present
      const cleanUsername = username.trim().replace(/^@/, '');

      // Validate posting key
      const postingWif = postingKey.trim();
      console.log('Validating posting key for:', cleanUsername);

      // Step 1: Validate posting key with Hive blockchain
      const privKey = PrivateKey.from(postingWif);
      const account = await client.database.getAccounts([cleanUsername]);
      if (!account || !account[0]) throw new Error('Account not found');
      const pubPosting = privKey.createPublic().toString();
      const postingAuths = account[0].posting.key_auths.map(([key]) => key);
      if (!postingAuths.includes(pubPosting))
        throw new Error('Invalid posting key');

      // Step 2: Validate active key if provided
      let activeWif: string | undefined;
      if (activeKey.trim()) {
        try {
          const activePrivKey = PrivateKey.from(activeKey.trim());
          const pubActive = activePrivKey.createPublic().toString();
          const activeAuths = account[0].active.key_auths.map(([key]) => key);
          if (!activeAuths.includes(pubActive)) {
            throw new Error('Invalid active key');
          }
          activeWif = activeKey.trim();
          console.log('[Login] Active key validated successfully');
        } catch (e) {
          throw new Error('Invalid active key for this account');
        }
      }

      // Step 3: Navigate to PIN setup screen
      console.log('[Login] Credentials validated, proceeding to PIN setup');
      setLoading(false);

      router.push({
        pathname: '/screens/PinEntryScreen' as any,
        params: {
          mode: 'setup',
          username: cleanUsername,
          postingKey: postingWif,
          activeKey: activeWif,
        },
      });
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Invalid username or posting key. Please try again.');
    }
  };

  const handleLearnMorePress = () => {
    Linking.openURL('https://hive.io/');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
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
                placeholder='Posting key'
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

              {/* Advanced Options */}
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={[styles.advancedText, { color: colors.button }]}>
                  Advanced Options
                </Text>
                <Ionicons
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.button}
                />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={styles.advancedContainer}>
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
                    placeholder='Active key (optional)'
                    placeholderTextColor={
                      colorScheme === 'dark' ? '#8899A6' : '#536471'
                    }
                    value={activeKey}
                    onChangeText={setActiveKey}
                    secureTextEntry
                    autoCapitalize='none'
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <Text
                    style={[
                      styles.helpText,
                      { color: colors.info, width: FIELD_WIDTH },
                    ]}
                  >
                    Optional - needed for wallet operations and changing avatar
                  </Text>
                </View>
              )}

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
                Your keys will be encrypted with a 6-digit PIN
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
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  advancedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
});
