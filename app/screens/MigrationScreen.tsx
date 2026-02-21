import {
    TouchableOpacity,
    useColorScheme,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Text, View } from '../../components/Themed';
import { useRouter } from 'expo-router';
import { getTheme, palette } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { AccountStorageService } from '../../services/AccountStorageService';
import { createMigrationScreenStyles } from '../../styles/MigrationScreenStyles';

export default function MigrationScreen() {
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark ? 'dark' : 'light');
    const router = useRouter();

    const styles = createMigrationScreenStyles(isDark);

    const handleSetupPin = async () => {
        setLoading(true);
        try {
            // Get legacy account
            const legacyAccount = await AccountStorageService.getLegacyAccount();

            if (!legacyAccount) {
                Alert.alert('Error', 'No account found to migrate');
                setLoading(false);
                return;
            }

            // Navigate to PIN setup with legacy account data
            router.push({
                pathname: '/screens/PinEntryScreen' as any,
                params: {
                    mode: 'setup',
                    username: legacyAccount.username,
                    postingKey: legacyAccount.postingKey,
                },
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={64} color={theme.button} />
                </View>

                {/* Title */}
                <Text style={styles.title}>
                    Enhanced Security
                </Text>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <Text style={styles.description}>
                        For improved security, we're upgrading how your account is protected.
                    </Text>
                    <Text style={styles.description}>
                        You'll now use a 6-digit PIN to unlock the app.
                    </Text>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                    <FeatureItem
                        icon="lock-closed"
                        title="PIN Protection"
                        description="Your posting key will be encrypted with your PIN"
                        theme={theme}
                    />
                    <FeatureItem
                        icon="people"
                        title="Multiple Accounts"
                        description="Add and switch between multiple Hive accounts"
                        theme={theme}
                    />
                    <FeatureItem
                        icon="time"
                        title="Session Timeout"
                        description="Auto-lock after 5 minutes of inactivity"
                        theme={theme}
                    />
                    <FeatureItem
                        icon="key"
                        title="Optional Active Key"
                        description="Store your active key to change avatars and more"
                        theme={theme}
                    />
                </View>

                {/* Setup Button */}
                <TouchableOpacity
                    style={styles.setupButton}
                    onPress={handleSetupPin}
                    disabled={loading}
                >
                    <Text style={styles.setupButtonText}>
                        {loading ? 'Loading...' : 'Set Up PIN'}
                    </Text>
                </TouchableOpacity>

                {/* Info Note */}
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color={theme.textSecondary} />
                    <Text style={styles.infoText}>
                        Your keys remain securely stored on your device. This upgrade adds an extra layer of protection.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

interface FeatureItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    theme: any;
}

function FeatureItem({ icon, title, description, theme }: FeatureItemProps) {
    const colorScheme = useColorScheme() || 'light';
    const isDark = colorScheme === 'dark';
    const styles = createMigrationScreenStyles(isDark);

    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
                <Ionicons name={icon} size={24} color={theme.button} />
            </View>
            <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>
                    {description}
                </Text>
            </View>
        </View>
    );
}
