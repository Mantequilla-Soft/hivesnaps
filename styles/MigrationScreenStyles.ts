import { StyleSheet } from 'react-native';
import { getTheme } from '../constants/Colors';

interface ExtendedTheme {
    background: string;
    text: string;
    textSecondary: string;
    button: string;
    buttonText: string;
    bubble: string;
}

export const createMigrationScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light') as ExtendedTheme;

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        content: {
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingVertical: 40,
            alignItems: 'center',
        },
        iconContainer: {
            width: 120,
            height: 120,
            borderRadius: 60,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            backgroundColor: theme.button + '20',
        },
        title: {
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
            color: theme.text,
        },
        descriptionContainer: {
            gap: 8,
            marginBottom: 32,
        },
        description: {
            fontSize: 16,
            textAlign: 'center',
            lineHeight: 24,
            color: theme.text,
        },
        featuresContainer: {
            width: '100%',
            gap: 16,
            marginBottom: 32,
        },
        featureItem: {
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
        },
        featureIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.button + '10',
        },
        featureContent: {
            flex: 1,
            gap: 4,
        },
        featureTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.text,
        },
        featureDescription: {
            fontSize: 14,
            lineHeight: 20,
            color: theme.textSecondary,
        },
        setupButton: {
            width: '100%',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 16,
            backgroundColor: theme.button,
        },
        setupButtonText: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.buttonText,
        },
        infoBox: {
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            alignItems: 'flex-start',
            backgroundColor: theme.bubble,
        },
        infoText: {
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
            color: theme.textSecondary,
        },
    });
};
