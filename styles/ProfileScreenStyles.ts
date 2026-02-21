import { StyleSheet } from 'react-native';
import { Theme, getTheme } from '../constants/Colors';

/**
 * ProfileScreen Styles
 * 
 * Uses centralized theme colors from constants/Colors.ts
 * Pass isDark to get the appropriate themed styles.
 */

interface ProfileScreenColors extends Theme {
  // Extended colors derived from base theme
  safeAreaBackground: string;
  headerBorderColor: string;
  defaultAvatarBackground: string;
  editAvatarTextColor: string;
  socialStatNumberColor: string;
  socialStatLabelColor: string;
  displayNameColor: string;
  aboutTextColor: string;
  statsSectionBackground: string;
  statLabelColor: string;
  statValueColor: string;
  unclaimedSectionBackground: string;
  unclaimedSectionBorderColor: string;
  unclaimedTitleColor: string;
  unclaimedTextColor: string;
  claimButtonBackground: string;
  infoTextColor: string;
  infoTextIconColor: string;
  snapsSectionTitleColor: string;
  loadSnapsButtonBackground: string;
  loadSnapsButtonTextColor: string;
  snapsErrorTextColor: string;
  retryButtonBackground: string;
  retryButtonTextColor: string;
  snapsEmptyTextColor: string;
  loadMoreButtonBackground: string;
  loadMoreButtonTextColor: string;
  logoutButtonBackground: string;
  errorTextColor: string;
}

export const createProfileScreenStyles = (isDark: boolean) => {
  const theme = getTheme(isDark ? 'dark' : 'light');

  // Create extended colors object with all the specific color mappings
  const extendedColors: ProfileScreenColors = {
    ...theme,
    // Additional colors for styles - derived from base theme
    safeAreaBackground: theme.background,
    headerBorderColor: theme.border,
    defaultAvatarBackground: theme.bubble,
    editAvatarTextColor: theme.icon,
    socialStatNumberColor: theme.text,
    socialStatLabelColor: theme.text,
    displayNameColor: theme.text,
    aboutTextColor: theme.text,
    statsSectionBackground: theme.bubble,
    statLabelColor: theme.text,
    statValueColor: theme.payout,
    unclaimedSectionBackground: theme.bubble,
    unclaimedSectionBorderColor: theme.border,
    unclaimedTitleColor: theme.text,
    unclaimedTextColor: theme.payout,
    claimButtonBackground: theme.icon,
    infoTextColor: theme.text,
    infoTextIconColor: theme.icon,
    snapsSectionTitleColor: theme.text,
    loadSnapsButtonBackground: theme.button,
    loadSnapsButtonTextColor: theme.buttonText,
    snapsErrorTextColor: theme.text,
    retryButtonBackground: theme.button,
    retryButtonTextColor: theme.buttonText,
    snapsEmptyTextColor: theme.text,
    loadMoreButtonBackground: theme.buttonInactive,
    loadMoreButtonTextColor: theme.text,
    logoutButtonBackground: theme.mutedButton,
    errorTextColor: theme.text,
  };

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: extendedColors.safeAreaBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: extendedColors.headerBorderColor,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
      textAlign: 'center',
      color: extendedColors.text,
    },
    headerSpacer: {
      width: 36, // Same width as back button to center title
    },
    content: {
      flex: 1,
    },
    profileSection: {
      padding: 24,
      alignItems: 'center',
    },
    username: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: extendedColors.text,
    },
    avatarContainer: {
      marginBottom: 16,
    },
    largeAvatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    defaultAvatar: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: extendedColors.defaultAvatarBackground,
    },
    editAvatarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    editAvatarText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 6,
      color: extendedColors.editAvatarTextColor,
    },
    displayName: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      textAlign: 'center',
      color: extendedColors.displayNameColor,
    },
    socialStats: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 40,
      marginBottom: 20,
    },
    socialStatItem: {
      alignItems: 'center',
    },
    socialStatNumber: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
      color: extendedColors.socialStatNumberColor,
    },
    socialStatLabel: {
      fontSize: 14,
      fontWeight: '500',
      opacity: 0.7,
      color: extendedColors.socialStatLabelColor,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    buttonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 14,
    },
    aboutSection: {
      marginBottom: 20,
      width: '100%',
    },
    aboutText: {
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'center',
      color: extendedColors.aboutTextColor,
    },
    statsSection: {
      width: '100%',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      backgroundColor: extendedColors.statsSectionBackground,
    },
    statItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: extendedColors.statLabelColor,
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.statValueColor,
    },
    additionalInfo: {
      width: '100%',
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoText: {
      fontSize: 15,
      color: extendedColors.infoTextColor,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: extendedColors.text,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: extendedColors.errorTextColor,
    },
    unclaimedSection: {
      width: '100%',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: extendedColors.unclaimedSectionBorderColor,
      backgroundColor: extendedColors.unclaimedSectionBackground,
    },
    unclaimedTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 12,
      color: extendedColors.unclaimedTitleColor,
    },
    unclaimedRewards: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16,
    },
    unclaimedText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.unclaimedTextColor,
    },
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      backgroundColor: extendedColors.claimButtonBackground,
    },
    claimButtonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    logoutSection: {
      width: '100%',
      marginTop: 20,
      marginBottom: 20,
      alignItems: 'center',
    },
    permissionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 4,
    },
    permissionBadgeText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      width: '100%',
      backgroundColor: extendedColors.logoutButtonBackground,
    },
    logoutButtonText: {
      color: extendedColors.buttonText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    // Snaps section styles
    snapsSection: {
      width: '100%',
      marginTop: 20,
    },
    snapsSectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
      color: extendedColors.snapsSectionTitleColor,
    },
    snapsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      position: 'relative',
    },
    refreshButton: {
      position: 'absolute',
      right: 0,
      padding: 8,
    },
    snapsLoadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsLoadingText: {
      marginTop: 8,
      fontSize: 14,
      color: extendedColors.text,
    },
    snapsErrorContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsErrorText: {
      marginTop: 8,
      fontSize: 14,
      textAlign: 'center',
      color: extendedColors.snapsErrorTextColor,
    },
    snapsEmptyContainer: {
      alignItems: 'center',
      padding: 40,
    },
    snapsEmptyText: {
      marginTop: 12,
      fontSize: 16,
      textAlign: 'center',
      color: extendedColors.snapsEmptyTextColor,
    },
    // Vertical feed styles (replacing horizontal bubble styles)
    verticalFeedContainer: {
      marginTop: 16,
    },
    // Load More button styles
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
      backgroundColor: extendedColors.loadMoreButtonBackground,
    },
    loadMoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: extendedColors.loadMoreButtonTextColor,
    },
    // Load snaps button styles
    loadSnapsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      gap: 8,
      marginBottom: 20,
      backgroundColor: extendedColors.loadSnapsButtonBackground,
    },
    loadSnapsButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: extendedColors.loadSnapsButtonTextColor,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginTop: 12,
      backgroundColor: extendedColors.retryButtonBackground,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: extendedColors.retryButtonTextColor,
    },
  });
};
