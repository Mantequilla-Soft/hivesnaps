import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const createFeedScreenStyles = (colors: any, isDark: boolean) => {
  return StyleSheet.create({
    // Main container styles
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    safeArea: {
      backgroundColor: colors.background,
    },

    // Top bar styles
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    profileButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoText: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
    },
    notificationButton: {
      position: 'relative',
    },
    bellBtn: {
      marginLeft: 8,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    rewardIndicator: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#FFD700',
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
      minWidth: 16,
      alignItems: 'center',
    },
    username: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },

    // Slogan styles
    sloganRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between', // Changed from 'center' to 'space-between'
      marginBottom: 16,
      paddingHorizontal: 16,
      minHeight: 40, // Added minimum height for consistent spacing
    },
    sloganText: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      textAlign: 'center',
      opacity: 0.8,
      flex: 1, // Added flex to center the text properly
      paddingHorizontal: 20, // Added horizontal padding for breathing room
    },
    slogan: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      textAlign: 'center',
      opacity: 0.8,
    },

    // Filter styles
    filterContainer: {
      marginBottom: 18,
      height: 44,
      position: 'relative',
    },
    filterScrollView: {
      flexGrow: 0,
    },
    filterScrollContent: {
      paddingHorizontal: 4,
      alignItems: 'center',
      minWidth: '100%',
    },
    filterBtnScrollable: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 22,
      minWidth: 100,
      height: 40,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    filterTextScrollable: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    filterIcon: {
      marginRight: 6,
    },

    // Fade indicator styles
    fadeIndicator: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 20,
      zIndex: 1,
      opacity: 0.8,
    },
    leftFade: {
      left: 0,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    rightFade: {
      right: 0,
      borderTopLeftRadius: 10,
      borderBottomLeftRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },

    // Feed list styles
    feedList: {
      flex: 1,
    },
    feedContent: {
      paddingBottom: 20,
    },
    feedContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    loadingText: {
      color: colors.text,
      marginTop: 16,
      fontSize: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyText: {
      color: colors.text,
      fontSize: 18,
      textAlign: 'center',
      marginTop: 16,
    },

    // Modal styles
    modalOverlay: {
      justifyContent: 'flex-end',
      margin: 0,
    },
    modalContent: {
      backgroundColor: colors.background,
      padding: 16,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      minHeight: 200,
      maxHeight: screenHeight * 0.8,
    },
    modalTitle: {
      color: colors.text,
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 8,
    },
    modalImagePreview: {
      marginBottom: 10,
    },
    modalImage: {
      width: 120,
      height: 120,
      borderRadius: 10,
    },
    modalCloseButton: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    modalGifBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    modalGifBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    modalErrorText: {
      color: 'red',
      marginBottom: 8,
    },

    // Input row styles
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    inputButton: {
      marginRight: 16,
      paddingBottom: 8,
    },
    inputButtonText: {
      fontSize: 18,
    },
    textInput: {
      flex: 1,
      minHeight: 60,
      maxHeight: 120,
      borderRadius: 10,
      padding: 10,
      marginRight: 10,
      textAlignVertical: 'top',
      backgroundColor: colors.bubble,
      color: colors.text,
    },
    inputSpinner: {
      marginRight: 8,
      marginBottom: 8,
    },
    submitButton: {
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginBottom: 8,
    },
    submitButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 15,
    },

    // Search styles
    searchBtn: {
      padding: 10, // Increased padding for better touch target
      borderRadius: 20,
      backgroundColor: colors.buttonInactive,
      width: 40, // Fixed width for consistency
      height: 40, // Fixed height for consistency
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    searchModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-start',
      paddingTop: 60,
    },
    searchContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      flex: 1,
      minHeight: '90%',
    },
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.buttonInactive,
    },
    searchHeaderTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    searchCloseBtn: {
      padding: 8,
    },
    searchInputContainer: {
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    searchInput: {
      backgroundColor: isDark ? '#22303C' : '#F5F8FA',
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.buttonInactive,
    },
    searchFilters: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 15,
    },
    searchFilterBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 10,
      borderWidth: 1,
      borderColor: colors.buttonInactive,
    },
    searchFilterBtnActive: {
      backgroundColor: colors.button,
      borderColor: colors.button,
    },
    searchFilterText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    searchFilterTextActive: {
      color: colors.buttonText,
    },
    searchContent: {
      flex: 1,
      paddingHorizontal: 20,
    },
    recentSearchesSection: {
      paddingVertical: 15,
    },
    recentSearchesTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    recentSearchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.buttonInactive,
      borderRadius: 8,
      marginBottom: 6,
    },
    recentSearchText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    clearRecentBtn: {
      padding: 4,
    },
    searchResults: {
      flex: 1,
    },
    searchResultsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 15,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.buttonInactive,
      borderRadius: 8,
      marginBottom: 8,
    },
    searchResultAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    searchResultInfo: {
      flex: 1,
    },
    searchResultUsername: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    searchResultMeta: {
      fontSize: 12,
      color: colors.text + '80',
      marginTop: 2,
    },
    searchResultContent: {
      fontSize: 14,
      color: colors.text,
      marginTop: 4,
      lineHeight: 18,
    },
    searchLoadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    searchLoadingText: {
      color: colors.text,
      marginTop: 10,
      fontSize: 16,
    },
    searchEmptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    searchEmptyText: {
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 10,
    },

    // GIF Picker Modal
    gifModal: {
      justifyContent: 'flex-end',
      margin: 0,
    },
    gifModalContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 32,
      minHeight: 420,
      maxHeight: '80%',
    },
    gifModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    gifModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    gifModalCloseBtn: {
      padding: 4,
      borderRadius: 16,
    },
    gifSearchBarContainer: {
      marginBottom: 12,
    },
    gifSearchInput: {
      backgroundColor: colors.inputBackground,
      color: colors.text,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gifResultsContainer: {
      flex: 1,
      minHeight: 200,
    },
    gifLoadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    gifResultItem: {
      flex: 1,
      margin: 6,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.inputBackground,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    gifResultImage: {
      width: '100%',
      aspectRatio: 1,
      minHeight: 120,
      maxHeight: 160,
    },
    gifEmptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    gifEmptyText: {
      marginTop: 12,
      color: colors.text,
      fontSize: 16,
      opacity: 0.7,
      textAlign: 'center',
    },

    // Keyboard avoiding view
    keyboardAvoidingView: {
      flex: 0,
    },

    // Platform specific styles
    iosModalPadding: {
      paddingBottom: 16,
    },
    androidModalPadding: {
      paddingBottom: 16,
    },

    // Shadow styles
    cardShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },

    // Utility styles
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    row: {
      flexDirection: 'row',
    },
    column: {
      flexDirection: 'column',
    },
    spaceBetween: {
      justifyContent: 'space-between',
    },
    alignCenter: {
      alignItems: 'center',
    },
    fullWidth: {
      width: '100%',
    },
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
    },

    // Resource Credits and Voting Power styles
    creditsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    creditsIcon: {
      marginLeft: 4,
    },
    creditsSeparator: {
      color: colors.text,
      fontSize: 12,
      marginHorizontal: 4,
    },
  });
};

// Color-agnostic base styles that don't depend on theme
export const baseStyles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flex1: {
    flex: 1,
  },
  flex0: {
    flex: 0,
  },
  zIndex1: {
    zIndex: 1,
  },
  zIndex2: {
    zIndex: 2,
  },
  zIndex3: {
    zIndex: 3,
  },
});
