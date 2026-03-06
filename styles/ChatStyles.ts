/**
 * Chat Styles
 * Centralized styles for all chat-related components
 */

import { StyleSheet } from 'react-native';

// ============================================================================
// Color Helpers
// ============================================================================

export const getChatColors = (isDark: boolean) => ({
  // Bubble
  bubble: '#1DA1F2',
  bubbleShadow: isDark ? '#000' : '#1DA1F2',
  bubbleIcon: '#FFFFFF',
  
  // Badge
  badge: '#FF3B30',
  badgeText: '#FFFFFF',
  
  // Screen
  background: isDark ? '#000000' : '#FFFFFF',
  headerBg: isDark ? '#1C1C1E' : '#F5F5F5',
  cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
  text: isDark ? '#FFFFFF' : '#000000',
  textSecondary: isDark ? '#8E8E93' : '#6B7280',
  accent: '#1DA1F2',
  
  // Messages
  messageBg: isDark ? '#2C2C2E' : '#E5E5EA',
  inputBg: isDark ? '#2C2C2E' : '#FFFFFF',
  reactionBg: isDark ? '#3A3A3C' : '#F0F0F0',
  
  // Borders
  border: isDark ? 'rgba(128, 128, 128, 0.3)' : 'rgba(128, 128, 128, 0.3)',
});

// ============================================================================
// ChatScreen Styles
// ============================================================================

export const createChatScreenStyles = () => {
  return StyleSheet.create({
    // Container
    container: {
      flex: 1,
    },
    
    // Loading & Error States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 12,
    },
    errorDetail: {
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    closeButton: {
      padding: 4,
      width: 44,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    headerSpacer: {
      width: 44,
    },
    backButton: {
      padding: 4,
      width: 44,
    },
    backText: {
      fontSize: 16,
    },

    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      minHeight: 44,
      width: '100%',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    tabBadge: {
      marginLeft: 6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    tabBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: 'bold',
    },

    // Content
    content: {
      flex: 1,
    },

    // Message List
    messageList: {
      flex: 1,
    },
    messageListContent: {
      padding: 12,
    },
    messagesLoading: {
      marginTop: 24,
    },
    emptyMessages: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 48,
    },
    emptyText: {
      fontSize: 16,
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: 14,
      marginTop: 4,
    },

    // Message Bubble
    messageBubbleContainer: {
      flexDirection: 'row',
      marginVertical: 4,
    },
    ownMessageContainer: {
      justifyContent: 'flex-end',
    },
    otherMessageContainer: {
      justifyContent: 'flex-start',
    },
    messageAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
    },
    messageContent: {
      maxWidth: '75%',
    },
    messageUsername: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 2,
    },
    messageBubble: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    messageFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    messageTime: {
      fontSize: 11,
    },
    reactionsContainer: {
      flexDirection: 'row',
      marginLeft: 8,
    },
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      marginRight: 4,
    },
    reactionEmoji: {
      fontSize: 12,
    },
    reactionCount: {
      fontSize: 11,
      marginLeft: 2,
    },
    quickReactions: {
      flexDirection: 'row',
      marginTop: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 16,
      alignSelf: 'flex-start',
    },
    quickReactionBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    quickReactionEmoji: {
      fontSize: 18,
    },

    // Input
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      fontSize: 15,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },

    // DM List
    dmList: {
      flex: 1,
    },
    dmListContent: {
      padding: 12,
    },
    dmChannelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    dmAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    dmInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'center',
    },
    dmUsername: {
      fontSize: 16,
      fontWeight: '500',
    },
    dmBadge: {
      marginRight: 8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    dmBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },

    // DM Search
    dmListContainer: {
      flex: 1,
    },
    dmSearchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 4,
      borderRadius: 10,
      gap: 8,
    },
    dmSearchInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 4,
    },

    // Start New DM
    startNewDmItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginHorizontal: 12,
      marginVertical: 4,
      borderRadius: 12,
    },
    startNewDmIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    startNewDmInfo: {
      flex: 1,
      marginLeft: 12,
    },
    startNewDmText: {
      fontSize: 14,
    },
    startNewDmUsername: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
};
