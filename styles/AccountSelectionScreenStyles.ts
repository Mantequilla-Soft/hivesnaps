import { StyleSheet } from 'react-native';
import { getTheme } from '../constants/Colors';

export const createAccountSelectionScreenStyles = (isDark: boolean) => {
  const theme = getTheme(isDark ? 'dark' : 'light');

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 4,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingVertical: 8,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    accountRowActive: {
      backgroundColor: theme.bubble,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.bubble,
    },
    accountInfo: {
      flex: 1,
      marginLeft: 12,
    },
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    username: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    currentBadge: {
      backgroundColor: theme.button,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    currentBadgeText: {
      color: theme.buttonText,
      fontSize: 11,
      fontWeight: 'bold',
    },
    lastUsed: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    switchingOverlay: {
      position: 'absolute',
      right: 16,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    addAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 25,
      backgroundColor: theme.button,
      gap: 8,
    },
    addAccountButtonText: {
      color: theme.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
};
