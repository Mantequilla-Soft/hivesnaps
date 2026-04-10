import React, { useState, useMemo } from 'react';
import {
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../../components/Themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { accountStorageService } from '../../services/AccountStorageService';
import { createMigrationScreenStyles } from '../../styles/MigrationScreenStyles';
import { useAppStore } from '../../store/context';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export default function MigrationScreen(): React.JSX.Element {
    const [loading, setLoading] = useState(false);

    const theme = useTheme();
    const router = useRouter();
    const { setCurrentUser, setHasActiveKey } = useAppStore();
    const { authenticate } = useAuth();

    const styles = useMemo(
        () => createMigrationScreenStyles(theme.isDark),
        [theme.isDark]
    );

    const handleMigrate = async (): Promise<void> => {
        setLoading(true);
        try {
            // getAccounts() triggers legacy migration internally —
            // moves hive_username / hive_posting_key to the new format.
            await accountStorageService.getAccounts();

            const username = await accountStorageService.getCurrentAccountUsername();
            if (!username) {
                Alert.alert(
                    'Migration Failed',
                    'Could not find your account after migration. Please log in manually.',
                    [{ text: 'OK', onPress: () => router.replace('/screens/LoginScreen') }]
                );
                return;
            }

            const keys = await accountStorageService.getAccountKeys(username);
            if (!keys) {
                Alert.alert(
                    'Migration Failed',
                    'Could not retrieve your keys after migration. Please log in manually.',
                    [{ text: 'OK', onPress: () => router.replace('/screens/LoginScreen') }]
                );
                return;
            }

            setCurrentUser(username);
            setHasActiveKey(!!keys.activeKey);

            // Re-authenticate to get a fresh JWT token
            const jwtSuccess = await authenticate(username, keys.postingKey);
            if (!jwtSuccess) {
                console.warn('[MigrationScreen] JWT auth failed after migration, continuing without token');
            }

            router.replace('/screens/FeedScreen');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            Alert.alert('Migration Failed', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={56} color={theme.button} />
                </View>

                {/* Title */}
                <Text style={styles.title}>Account Upgrade</Text>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <Text style={styles.description}>
                        We've improved how your account is protected on this device.
                    </Text>
                    <Text style={styles.description}>
                        Tap below to complete the upgrade — your keys stay securely on your device.
                    </Text>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                    <FeatureItem
                        icon="lock-closed"
                        title="Device-Level Protection"
                        description="Your keys are protected by your device's OS security"
                        styles={styles}
                        buttonColor={theme.button}
                    />
                    <FeatureItem
                        icon="people"
                        title="Multiple Accounts"
                        description="Add and switch between multiple Hive accounts"
                        styles={styles}
                        buttonColor={theme.button}
                    />
                    <FeatureItem
                        icon="key"
                        title="Active Key Support"
                        description="Optionally store your active key for wallet operations"
                        styles={styles}
                        buttonColor={theme.button}
                    />
                </View>

                {/* Migrate Button */}
                <TouchableOpacity
                    style={[styles.setupButton, { opacity: loading ? 0.6 : 1 }]}
                    onPress={handleMigrate}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Upgrade my account"
                    accessibilityState={{ disabled: loading }}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.buttonText} />
                    ) : (
                        <Text style={styles.setupButtonText}>Upgrade My Account</Text>
                    )}
                </TouchableOpacity>

                {/* Info Note */}
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={18} color={theme.textSecondary} />
                    <Text style={styles.infoText}>
                        Your keys are never sent to any server. This upgrade only changes how they're stored on your device.
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
    styles: ReturnType<typeof createMigrationScreenStyles>;
    buttonColor: string;
}

function FeatureItem({ icon, title, description, styles, buttonColor }: FeatureItemProps): React.JSX.Element {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
                <Ionicons name={icon} size={22} color={buttonColor} />
            </View>
            <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    );
}

export const options = { headerShown: false };
