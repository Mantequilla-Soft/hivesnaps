import { StyleSheet } from 'react-native';
import { Theme, getTheme } from '../constants/Colors';

/**
 * AccountSelectionScreen Styles
 * 
 * Uses centralized theme colors from constants/Colors.ts
 * Pass isDark to get the appropriate themed styles.
 */

interface AccountSelectionScreenColors extends Theme {
    // Extended colors derived from base theme
    containerBackground: string;
    loadingTextColor: string;
    titleColor: string;
    subtitleColor: string;
    accountItemBackground: string;
    usernameColor: string;
    badgeSuccessBackground: string;
    badgeSuccessBorder: string;
    badgeSuccessText: string;
    badgePrimaryBackground: string;
    badgePrimaryBorder: string;
    badgePrimaryText: string;
    chevronColor: string;
    emptyIconColor: string;
    emptyTextColor: string;
    footerBorderColor: string;
    addButtonBackground: string;
    addButtonTextColor: string;
}

export const createAccountSelectionScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light');

    // Create extended colors object with all the specific color mappings
    const extendedColors: AccountSelectionScreenColors = {
        ...theme,
        // Additional colors for styles - derived from base theme
        containerBackground: theme.background,
        loadingTextColor: theme.textSecondary,
        titleColor: theme.text,
        subtitleColor: theme.textSecondary,
        accountItemBackground: theme.bubble,
        usernameColor: theme.text,
        badgeSuccessBackground: theme.background,
        badgeSuccessBorder: theme.background,
        badgeSuccessText: theme.text,
        badgePrimaryBackground: theme.background,
        badgePrimaryBorder: theme.background,
        badgePrimaryText: theme.text,
        chevronColor: theme.textSecondary,
        emptyIconColor: theme.textSecondary,
        emptyTextColor: theme.textSecondary,
        footerBorderColor: theme.border,
        addButtonBackground: theme.button,
        addButtonTextColor: theme.buttonText,
    };

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: extendedColors.containerBackground,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        loadingText: {
            color: extendedColors.loadingTextColor,
        },
        header: {
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
        },
        title: {
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 4,
            color: extendedColors.titleColor,
        },
        subtitle: {
            fontSize: 16,
            color: extendedColors.subtitleColor,
        },
        helpText: {
            fontSize: 14,
            color: extendedColors.subtitleColor,
            marginBottom: 16,
            opacity: 0.8,
        },
        listContent: {
            flexGrow: 0,
            paddingHorizontal: 20,
            paddingBottom: 20,
        },
        accountItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderRadius: 16,
            gap: 12,
            backgroundColor: extendedColors.accountItemBackground,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
        },
        avatar: {
            width: 56,
            height: 56,
            borderRadius: 28,
        },
        accountInfo: {
            flex: 1,
            gap: 6,
        },
        username: {
            fontSize: 18,
            fontWeight: '600',
            color: extendedColors.usernameColor,
        },
        badgeContainer: {
            flexDirection: 'row',
            gap: 8,
        },
        badge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: '600',
        },
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60,
            gap: 16,
        },
        emptyText: {
            fontSize: 16,
            color: extendedColors.emptyTextColor,
        },
        addButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 16,
            gap: 8,
            marginTop: 16,
            backgroundColor: extendedColors.addButtonBackground,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
        },
        addButtonText: {
            fontSize: 18,
            fontWeight: '600',
            color: extendedColors.addButtonTextColor,
        },
    });
};
