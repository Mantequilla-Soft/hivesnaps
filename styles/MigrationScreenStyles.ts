import { StyleSheet } from 'react-native';
import { getTheme } from '../constants/Colors';

export const createMigrationScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light');

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
            backgroundColor: (theme.button as string) + '20',
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
            color: theme.text,
        },
        descriptionContainer: {
            gap: 8,
            marginBottom: 32,
            width: '100%',
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
            backgroundColor: theme.bubble,
            borderRadius: 12,
            padding: 12,
        },
        featureIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: (theme.button as string) + '15',
        },
        featureContent: {
            flex: 1,
            gap: 2,
        },
        featureTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.text,
        },
        featureDescription: {
            fontSize: 13,
            lineHeight: 18,
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
            fontSize: 17,
            fontWeight: '600',
            color: theme.buttonText,
        },
        infoBox: {
            flexDirection: 'row',
            gap: 10,
            padding: 14,
            borderRadius: 12,
            alignItems: 'flex-start',
            backgroundColor: theme.bubble,
            width: '100%',
        },
        infoText: {
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
            color: theme.textSecondary,
        },
    });
};
