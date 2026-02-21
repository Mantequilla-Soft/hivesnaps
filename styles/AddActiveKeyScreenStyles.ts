import { StyleSheet, Dimensions } from 'react-native';
import { Theme, getTheme, hexToRgba } from '../constants/Colors';

/**
 * AddActiveKeyScreen Styles
 * 
 * Uses centralized theme colors from constants/Colors.ts
 * Pass isDark to get the appropriate themed styles.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIELD_WIDTH = SCREEN_WIDTH * 0.8;

interface AddActiveKeyScreenColors extends Theme {
    // Extended colors derived from base theme
    containerBackground: string;
    titleColor: string;
    subtitleColor: string;
    infoBoxBackground: string;
    infoIconColor: string;
    infoTitleColor: string;
    infoTextColor: string;
    labelColor: string;
    inputBackground: string;
    inputBorderColor: string;
    inputTextColor: string;
    inputPlaceholderColor: string;
    errorIconColor: string;
    errorTextColor: string;
    buttonBackground: string;
    buttonTextColor: string;
    backButtonTextColor: string;
    warningBoxBackground: string;
    warningIconColor: string;
    warningTextColor: string;
    cancelTextColor: string;
}

export const createAddActiveKeyScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light');

    // Create extended colors object with all the specific color mappings
    const extendedColors: AddActiveKeyScreenColors = {
        ...theme,
        // Additional colors for styles - derived from base theme
        containerBackground: theme.background,
        titleColor: theme.text,
        subtitleColor: theme.textSecondary,
        infoBoxBackground: hexToRgba(theme.button, 0.1),
        infoIconColor: theme.button,
        infoTitleColor: theme.text,
        infoTextColor: theme.textSecondary,
        labelColor: theme.text,
        inputBackground: theme.bubble,
        inputBorderColor: theme.inputBorder,
        inputTextColor: theme.text,
        inputPlaceholderColor: theme.textSecondary,
        errorIconColor: theme.text,
        errorTextColor: theme.text,
        buttonBackground: theme.button,
        buttonTextColor: theme.buttonText,
        backButtonTextColor: theme.textSecondary,
        warningBoxBackground: theme.background,
        warningIconColor: theme.text,
        warningTextColor: theme.text,
        cancelTextColor: theme.textSecondary,
    };

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: extendedColors.containerBackground,
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
            color: extendedColors.titleColor,
        },
        subtitle: {
            fontSize: 16,
            textAlign: 'center',
            color: extendedColors.subtitleColor,
        },
        infoBox: {
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            marginBottom: 24,
            backgroundColor: extendedColors.infoBoxBackground,
        },
        infoContent: {
            flex: 1,
            gap: 4,
        },
        infoTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: extendedColors.infoTitleColor,
        },
        infoText: {
            fontSize: 14,
            lineHeight: 20,
            color: extendedColors.infoTextColor,
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
            color: extendedColors.labelColor,
        },
        input: {
            width: FIELD_WIDTH,
            height: 50,
            borderRadius: 8,
            paddingHorizontal: 16,
            fontSize: 16,
            borderWidth: 1,
            backgroundColor: extendedColors.inputBackground,
            color: extendedColors.inputTextColor,
            borderColor: extendedColors.inputBorderColor,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        errorText: {
            fontSize: 14,
            flex: 1,
        },
        button: {
            width: FIELD_WIDTH,
            height: 50,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: extendedColors.buttonBackground,
        },
        buttonText: {
            fontSize: 18,
            fontWeight: '600',
            color: extendedColors.buttonTextColor,
        },
        backButton: {
            paddingVertical: 12,
            alignItems: 'center',
        },
        backButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: extendedColors.backButtonTextColor,
        },
        warningBox: {
            flexDirection: 'row',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            alignItems: 'flex-start',
        },
        warningText: {
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
        },
        cancelButton: {
            marginTop: 'auto',
            paddingVertical: 12,
            alignItems: 'center',
        },
        cancelText: {
            fontSize: 16,
            fontWeight: '600',
            color: extendedColors.cancelTextColor,
        },
    });
};
