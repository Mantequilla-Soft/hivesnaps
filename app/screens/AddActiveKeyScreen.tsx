import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { palette } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import {
  accountStorageService,
  InvalidKeyError,
  AccountNotFoundError,
  KeyValidationError,
} from '../../services/AccountStorageService';
import { localAuthService, AuthCancelledError, AuthFailedError } from '../../services/LocalAuthService';
import { useAuth } from '../../hooks/useAuth';
import { createAddActiveKeyScreenStyles } from '../../styles/AddActiveKeyScreenStyles';

export default function AddActiveKeyScreen(): React.JSX.Element {
  const [activeKey, setActiveKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const router = useRouter();
  const { currentUsername, setHasActiveKey } = useAuth();

  const styles = useMemo(() => createAddActiveKeyScreenStyles(theme.isDark), [theme.isDark]);

  const { username: rawUsername } = useLocalSearchParams<{ username?: string | string[] }>();
  // Canonicalize: collapse array → scalar, then normalise to match stored username format
  const username = (Array.isArray(rawUsername) ? rawUsername[0] : rawUsername)
    ?.trim().replace(/^@/, '').toLowerCase();

  const handleAddKey = async (): Promise<void> => {
    if (!activeKey.trim()) {
      setError('Please enter your active key');
      return;
    }
    if (!username) {
      setError('No account selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Confirm intent with biometric / device PIN if the device has one enrolled.
      // If no security is set up (e.g. emulator) we skip the prompt — the key is
      // still encrypted by SecureStore's device-level encryption.
      const biometricAvailable = await localAuthService.isAvailable();
      if (biometricAvailable) {
        await localAuthService.authenticate('Confirm your identity to add an active key');
      }

      // Validates against blockchain and stores — throws on invalid key
      await accountStorageService.addActiveKey(username, activeKey.trim());

      if (currentUsername === username) {
        setHasActiveKey(true);
      }

      Alert.alert(
        'Success',
        'Active key added. Wallet operations are now enabled for this account.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      if (err instanceof AuthCancelledError) {
        setError('Authentication was cancelled');
      } else if (err instanceof AuthFailedError) {
        setError('Device authentication failed. Please try again.');
      } else if (err instanceof InvalidKeyError) {
        setError('The key you entered does not match the active key for this account.');
      } else if (err instanceof AccountNotFoundError) {
        setError('Account not found on the blockchain.');
      } else if (err instanceof KeyValidationError) {
        setError('Unable to validate the key. Please check your connection and try again.');
      } else {
        setError('Failed to add active key. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Add Active Key</Text>
              <Text style={styles.subtitle}>For @{username}</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color={theme.button} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Why add an active key?</Text>
                <Text style={styles.infoText}>
                  Active keys unlock wallet operations, avatar updates, and account-level actions.
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Active Key</Text>
                <TextInput
                  style={styles.input}
                  value={activeKey}
                  onChangeText={setActiveKey}
                  placeholder="5J..."
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color={palette.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.button, { opacity: loading || !activeKey.trim() ? 0.5 : 1 }]}
                onPress={handleAddKey}
                disabled={loading || !activeKey.trim()}
                accessibilityRole="button"
                accessibilityLabel="Add active key"
                accessibilityState={{ disabled: loading || !activeKey.trim() }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.buttonText} />
                ) : (
                  <Text style={styles.buttonText}>Add Active Key</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={palette.warning} />
              <Text style={styles.warningText}>Never share your active key with anyone.</Text>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { opacity: loading ? 0.4 : 1 }]}
              onPress={() => router.back()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
