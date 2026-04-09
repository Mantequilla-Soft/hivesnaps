import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  useColorScheme,
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
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { accountStorageService } from '../../services/AccountStorageService';
import { localAuthService, AuthCancelledError } from '../../services/LocalAuthService';
import { useAppStore } from '../../store/context';
import { createAddActiveKeyScreenStyles } from '../../styles/AddActiveKeyScreenStyles';

export default function AddActiveKeyScreen() {
  const [activeKey, setActiveKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark ? 'dark' : 'light');
  const router = useRouter();
  const { setHasActiveKey, selectors } = useAppStore();

  const styles = useMemo(() => createAddActiveKeyScreenStyles(isDark), [isDark]);

  const { username } = useLocalSearchParams<{ username?: string }>();

  const handleAddKey = async () => {
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
      // Confirm intent with biometric / device PIN before touching key storage
      await localAuthService.authenticate('Confirm your identity to add an active key');

      // Validates against blockchain and stores — throws on invalid key
      await accountStorageService.addActiveKey(username, activeKey.trim());

      if (selectors.getCurrentUser() === username) {
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
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add active key');
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
              style={styles.cancelButton}
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
