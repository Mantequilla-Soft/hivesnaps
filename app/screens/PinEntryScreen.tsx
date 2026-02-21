import {
    TouchableOpacity,
    useColorScheme,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { AccountStorageService } from '../../services/AccountStorageService';
import { SessionService } from '../../services/SessionService';
import { useAppStore } from '../../store/context';
import { useAuth } from '../../hooks/useAuth';
import { validatePinFormat } from '../../utils/pinEncryption';
import { createPinEntryScreenStyles } from '../../styles/PinEntryScreenStyles';

type PinMode = 'setup' | 'unlock' | 'confirm';

export default function PinEntryScreen() {
    const [pin, setPin] = useState('');
    const [confirmedPin, setConfirmedPin] = useState('');
    const [mode, setMode] = useState<PinMode>('unlock');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark ? 'dark' : 'light');
    const router = useRouter();
    const { setCurrentUser, setHasActiveKey } = useAppStore();
    const { authenticate } = useAuth();

    const styles = createPinEntryScreenStyles(isDark);

    // Get params: mode, username, postingKey, activeKey (for setup after login)
    const params = useLocalSearchParams<{
        mode?: string;
        username?: string;
        postingKey?: string;
        activeKey?: string;
    }>();

    useEffect(() => {
        if (params.mode === 'setup') {
            setMode('setup');
        }
    }, [params.mode]);

    const MAX_ATTEMPTS = 3;

    const handleNumberPress = (num: string) => {
        if (pin.length < 6) {
            const newPin = pin + num;
            setPin(newPin);
            setError('');

            // Auto-submit when 6 digits are entered
            if (newPin.length === 6) {
                setTimeout(() => handleSubmit(newPin), 100);
            }
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
        setError('');
    };

    const handleSubmit = async (submittedPin: string = pin) => {
        if (submittedPin.length !== 6) {
            setError('PIN must be 6 digits');
            return;
        }

        if (!validatePinFormat(submittedPin)) {
            setError('PIN must contain only numbers');
            return;
        }

        setLoading(true);

        try {
            if (mode === 'setup') {
                // First entry for setup - ask for confirmation
                setConfirmedPin(submittedPin);
                setMode('confirm');
                setPin('');
                setLoading(false);
                return;
            }

            if (mode === 'confirm') {
                // Confirm PIN during setup
                if (submittedPin !== confirmedPin) {
                    setError('PINs do not match');
                    setPin('');
                    setMode('setup');
                    setConfirmedPin('');
                    setLoading(false);
                    return;
                }

                // Save account with encrypted keys
                if (!params.username || !params.postingKey) {
                    setError('Missing account data');
                    setLoading(false);
                    return;
                }

                await AccountStorageService.addAccount(
                    params.username,
                    params.postingKey,
                    submittedPin,
                    params.activeKey
                );

                // Record session
                SessionService.recordUnlock(
                    params.username,
                    params.postingKey,
                    params.activeKey
                );

                // Update app state
                setCurrentUser(params.username);
                setHasActiveKey(!!params.activeKey);

                // Authenticate with backend to get JWT token
                console.log('[PinEntry] Authenticating with backend to get JWT token...');
                const authSuccess = await authenticate(params.username, params.postingKey);
                if (!authSuccess) {
                    console.error('[PinEntry] ❌ JWT authentication failed');
                    setLoading(false);
                    Alert.alert(
                        'Authentication Failed',
                        'Could not connect to server. Please check your internet connection and try again.',
                        [
                            { text: 'Retry', onPress: () => handleSubmit() },
                            { text: 'Cancel', onPress: () => router.replace('/screens/LoginScreen'), style: 'cancel' }
                        ]
                    );
                    return;
                }

                console.log('[PinEntry] ✅ JWT authentication successful');

                // Navigate to feed
                router.replace('/screens/FeedScreen');
                setLoading(false);
                return;
            }

            if (mode === 'unlock') {
                // Unlock existing account
                if (!params.username) {
                    setError('No account selected');
                    setLoading(false);
                    return;
                }

                try {
                    const decryptedAccount = await AccountStorageService.unlockAccount(
                        params.username,
                        submittedPin
                    );

                    // Record session
                    SessionService.recordUnlock(
                        params.username,
                        decryptedAccount.postingKey,
                        decryptedAccount.activeKey
                    );

                    // Update app state
                    setCurrentUser(params.username);
                    setHasActiveKey(!!decryptedAccount.activeKey);

                    // Authenticate with backend to get JWT token
                    console.log('[PinEntry] Authenticating with backend to get JWT token...');
                    const authSuccess = await authenticate(params.username, decryptedAccount.postingKey);
                    if (!authSuccess) {
                        console.error('[PinEntry] ❌ JWT authentication failed');
                        setLoading(false);
                        Alert.alert(
                            'Authentication Failed',
                            'Could not connect to server. Please check your internet connection and try again.',
                            [
                                { text: 'Retry', onPress: () => handleSubmit() },
                                { text: 'Cancel', onPress: () => router.back(), style: 'cancel' }
                            ]
                        );
                        return;
                    }

                    console.log('[PinEntry] ✅ JWT authentication successful');

                    // Navigate to feed
                    router.replace('/screens/FeedScreen');
                } catch (error) {
                    const newAttempts = attempts + 1;
                    setAttempts(newAttempts);

                    if (newAttempts >= MAX_ATTEMPTS) {
                        Alert.alert(
                            'Too Many Attempts',
                            'You have entered an incorrect PIN too many times. Please select an account again.',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => router.replace('/screens/AccountSelectionScreen' as any),
                                },
                            ]
                        );
                    } else {
                        setError(`Incorrect PIN (${newAttempts}/${MAX_ATTEMPTS})`);
                        setPin('');
                    }
                }
            }
        } catch (error: any) {
            setError(error.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const renderPinDots = () => {
        const dots = [];
        for (let i = 0; i < 6; i++) {
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.pinDot,
                        i < pin.length ? styles.pinDotFilled : styles.pinDotEmpty,
                    ]}
                />
            );
        }
        return dots;
    };

    const renderKeypadButton = (num: string) => (
        <TouchableOpacity
            key={num}
            style={styles.keypadButton}
            onPress={() => handleNumberPress(num)}
            disabled={loading}
        >
            <Text style={styles.keypadButtonText}>{num}</Text>
        </TouchableOpacity>
    );

    const getTitle = () => {
        if (mode === 'setup') return 'Create Your PIN';
        if (mode === 'confirm') return 'Confirm Your PIN';
        return 'Enter Your PIN';
    };

    const getSubtitle = () => {
        if (mode === 'setup') return 'Create a 6-digit PIN to secure your account';
        if (mode === 'confirm') return 'Enter your PIN again to confirm';
        return params.username ? `Unlock ${params.username}` : 'Enter PIN to unlock';
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>{getTitle()}</Text>
                    <Text style={styles.subtitle}>
                        {getSubtitle()}
                    </Text>
                </View>

                {/* PIN Display */}
                <View style={styles.pinDisplay}>{renderPinDots()}</View>

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                    </View>
                ) : (
                    <View style={styles.errorContainer} />
                )}

                {/* Loading Indicator */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.button} />
                    </View>
                )}

                {/* Numeric Keypad */}
                <View style={styles.keypad}>
                    <View style={styles.keypadRow}>
                        {renderKeypadButton('1')}
                        {renderKeypadButton('2')}
                        {renderKeypadButton('3')}
                    </View>
                    <View style={styles.keypadRow}>
                        {renderKeypadButton('4')}
                        {renderKeypadButton('5')}
                        {renderKeypadButton('6')}
                    </View>
                    <View style={styles.keypadRow}>
                        {renderKeypadButton('7')}
                        {renderKeypadButton('8')}
                        {renderKeypadButton('9')}
                    </View>
                    <View style={styles.keypadRow}>
                        <View style={styles.keypadButton} />
                        {renderKeypadButton('0')}
                        <TouchableOpacity
                            style={styles.keypadButton}
                            onPress={handleBackspace}
                            disabled={loading}
                        >
                            <Ionicons name="backspace-outline" size={32} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                    disabled={loading}
                >
                    <Text style={styles.cancelText}>
                        Cancel
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
