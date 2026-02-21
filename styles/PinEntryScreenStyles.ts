import { StyleSheet } from 'react-native';
import { getTheme } from '../constants/Colors';

interface ExtendedTheme {
    background: string;
    text: string;
    textSecondary: string;
    button: string;
    buttonText: string;
    bubble: string;
    inputBorder: string;
}

export const createPinEntryScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light') as ExtendedTheme;

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        content: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingVertical: 40,
        },
        header: {
            alignItems: 'center',
            paddingHorizontal: 20,
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 8,
            color: theme.text,
        },
        subtitle: {
            fontSize: 16,
            textAlign: 'center',
            color: theme.textSecondary,
        },
        pinDisplay: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            marginVertical: 20,
        },
        pinDot: {
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: theme.inputBorder,
        },
        pinDotFilled: {
            backgroundColor: theme.button,
        },
        pinDotEmpty: {
            backgroundColor: 'transparent',
        },
        errorContainer: {
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        errorText: {
            fontSize: 14,
            fontWeight: '600',
        },
        loadingContainer: {
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        keypad: {
            gap: 12,
        },
        keypadRow: {
            flexDirection: 'row',
            gap: 12,
        },
        keypadButton: {
            width: 80,
            height: 80,
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.bubble,
        },
        keypadButtonText: {
            fontSize: 32,
            fontWeight: '600',
            color: theme.text,
        },
        cancelButton: {
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        cancelText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.textSecondary,
        },
    });
};
