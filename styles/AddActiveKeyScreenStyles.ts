import { StyleSheet, Dimensions } from 'react-native';
import { getTheme, palette } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_WIDTH = SCREEN_WIDTH * 0.8;

export const createAddActiveKeyScreenStyles = (isDark: boolean): ReturnType<typeof StyleSheet.create> => {
    const theme = getTheme(isDark ? 'dark' : 'light');

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        keyboardView: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingVertical: 40,
        },
        header: {
            alignItems: 'center',
            marginBottom: 24,
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
        infoBox: {
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            marginBottom: 24,
            backgroundColor: theme.infoBoxBackground,
        },
        infoContent: {
            flex: 1,
            gap: 4,
        },
        infoTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.text,
        },
        infoText: {
            fontSize: 14,
            lineHeight: 20,
            color: theme.textSecondary,
        },
        form: {
            gap: 16,
            marginBottom: 24,
        },
        inputContainer: {
            gap: 8,
        },
        label: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.text,
        },
        input: {
            width: FIELD_WIDTH,
            height: 50,
            borderRadius: 8,
            paddingHorizontal: 16,
            fontSize: 16,
            borderWidth: 1,
            backgroundColor: theme.bubble,
            color: theme.text,
            borderColor: theme.inputBorder,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        errorText: {
            fontSize: 14,
            flex: 1,
            color: palette.error,
        },
        button: {
            width: FIELD_WIDTH,
            height: 50,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.button,
        },
        buttonText: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.buttonText,
        },
        warningBox: {
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            alignItems: 'flex-start',
            backgroundColor: theme.warningBoxBackground,
            marginBottom: 16,
        },
        warningText: {
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
            color: theme.text,
        },
        cancelButton: {
            marginTop: 'auto',
            paddingVertical: 12,
            alignItems: 'center',
        },
        cancelText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.textSecondary,
        },
    });
};
