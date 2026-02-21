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
import { useState } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { AccountStorageService } from '../../services/AccountStorageService';
import { SessionService } from '../../services/SessionService';
import { useAppStore } from '../../store/context';
import { createAddActiveKeyScreenStyles } from '../../styles/AddActiveKeyScreenStyles';

export default function AddActiveKeyScreen() {
    const [activeKey, setActiveKey] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'key' | 'pin'>('key');

    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark ? 'dark' : 'light');
    const router = useRouter();
    const { setHasActiveKey } = useAppStore();

    const styles = createAddActiveKeyScreenStyles(isDark);

    const params = useLocalSearchParams<{ username?: string }>();
    const username = params.username;

    const handleVerifyKey = async () => {
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
            // Validate active key
            const isValid = await AccountStorageService.validateActiveKey(username, activeKey.trim());

            if (!isValid) {
                setError('Invalid active key for this account');
                setLoading(false);
                return;
            }

            // Move to PIN step
            setStep('pin');
            setLoading(false);
        } catch (error: any) {
            setError(error.message || 'Failed to validate active key');
            setLoading(false);
        }
    };

    const handleAddKey = async () => {
        if (!pin.trim()) {
            setError('Please enter your PIN');
            return;
        }

        if (pin.length !== 6) {
            setError('PIN must be 6 digits');
            return;
        }

        if (!username) {
            setError('No account selected');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await AccountStorageService.addActiveKeyToAccount(username, activeKey.trim(), pin);

            // Update the current session with the active key
            const currentPostingKey = SessionService.getCurrentPostingKey();
            if (currentPostingKey) {
                SessionService.recordUnlock(username, currentPostingKey, activeKey.trim());
            }

            // Update app state to reflect that active key is now available
            setHasActiveKey(true);

            Alert.alert(
                'Success',
                'Active key added successfully! You now have full access to wallet features.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (error: any) {
            if (error.message === 'Incorrect PIN') {
                setError('Incorrect PIN. Please try again.');
            } else {
                setError(error.message || 'Failed to add active key');
            }
            setLoading(false);
        }
    };

    const renderKeyStep = () => (
        <>
            <View style={styles.header}>
                <Text style={styles.title}>Add Active Key</Text>
                <Text style={styles.subtitle}>
                    For @{username}
                </Text>
            </View>

            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={24} color={theme.button} />
                <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>
                        Why add an active key?
                    </Text>
                    <Text style={styles.infoText}>
                        Active keys unlock wallet features like transfers, changing avatars, and managing delegations.
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
                        <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            opacity: loading || !activeKey.trim() ? 0.5 : 1,
                        },
                    ]}
                    onPress={handleVerifyKey}
                    disabled={loading || !activeKey.trim()}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.buttonText} />
                    ) : (
                        <Text style={styles.buttonText}>
                            Verify Active Key
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={[styles.warningBox, { backgroundColor: palette.warning + '20' }]}>
                <Ionicons name="warning" size={20} color={palette.warning} />
                <Text style={[styles.warningText, { color: theme.text }]}>
                    Never share your active key with anyone. HiveSnaps will encrypt and store it securely on your device.
                </Text>
            </View>
        </>
    );

    const renderPinStep = () => (
        <>
            <View style={styles.header}>
                <Text style={styles.title}>Enter Your PIN</Text>
                <Text style={styles.subtitle}>
                    Confirm your PIN to encrypt the active key
                </Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>PIN</Text>
                    <TextInput
                        style={styles.input}
                        value={pin}
                        onChangeText={setPin}
                        placeholder="Enter 6-digit PIN"
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry
                        keyboardType="number-pad"
                        maxLength={6}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        autoFocus
                    />
                </View>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={20} color={palette.error} />
                        <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            opacity: loading || pin.length !== 6 ? 0.5 : 1,
                        },
                    ]}
                    onPress={handleAddKey}
                    disabled={loading || pin.length !== 6}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.buttonText} />
                    ) : (
                        <Text style={styles.buttonText}>
                            Add Active Key
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        setStep('key');
                        setPin('');
                        setError('');
                    }}
                    disabled={loading}
                >
                    <Text style={styles.backButtonText}>
                        Back
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

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
                        {step === 'key' ? renderKeyStep() : renderPinStep()}

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => router.back()}
                            disabled={loading}
                        >
                            <Text style={styles.cancelText}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
