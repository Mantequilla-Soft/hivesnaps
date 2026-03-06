/**
 * ChatContext - Global chat state management
 * Single source of truth for all chat state — ChatScreen consumes this context
 * instead of creating its own hook instance.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { Modal, View } from 'react-native';

import { useEcencyChat, UseEcencyChatResult } from '../hooks/useEcencyChat';
import { ChatScreen } from '../app/components/chat/ChatScreen';
import { useCurrentUser } from '../store/context';

// ============================================================================
// Types
// ============================================================================

interface ChatContextValue extends UseEcencyChatResult {
  /** Whether chat modal is currently open */
  isChatModalOpen: boolean;
  /** Open the chat screen */
  openChat: () => void;
  /** Close the chat screen */
  closeChat: () => void;
  /** Start a DM with a specific user and open chat */
  startDmWithUser: (username: string) => Promise<void>;
  /** Alias for dmsUnread (used by FeedScreen) */
  dmsUnreadCount: number;
}

// ============================================================================
// Context
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
}) => {
  const username = useCurrentUser();
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Single hook instance — all chat state lives here
  const {
    isInitialized,
    isInitializing,
    initError,
    channels,
    communityChannel,
    dmChannels,
    selectedChannel,
    messages,
    messagesLoading,
    usersMap,
    totalUnread,
    communityUnread,
    dmsUnread,
    channelUnreads,
    activeTab,
    isChatOpen,
    isConnected,
    initialize,
    selectChannel,
    setActiveTab,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    refreshChannels,
    refreshMessages,
    markAsRead,
    startDm,
  } = useEcencyChat(username, isChatModalOpen);

  // Auto-initialize chat when user is logged in
  useEffect(() => {
    if (username && !isInitialized && !isInitializing) {
      console.log('[ChatProvider] Auto-initializing chat for user:', username);
      initialize();
    }
  }, [username, isInitialized, isInitializing, initialize]);

  const openChat = useCallback(() => {
    setIsChatModalOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatModalOpen(false);
  }, []);

  const startDmWithUser = useCallback(async (targetUsername: string) => {
    if (!isInitialized) {
      await initialize();
    }
    await startDm(targetUsername);
    setIsChatModalOpen(true);
  }, [isInitialized, initialize, startDm]);

  // Memoize context value with explicit dependencies (not the hook object)
  const value = useMemo<ChatContextValue>(() => ({
    isInitialized,
    isInitializing,
    initError,
    channels,
    communityChannel,
    dmChannels,
    selectedChannel,
    messages,
    messagesLoading,
    usersMap,
    totalUnread,
    communityUnread,
    dmsUnread,
    channelUnreads,
    activeTab,
    isChatOpen,
    isConnected,
    initialize,
    selectChannel,
    setActiveTab,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    refreshChannels,
    refreshMessages,
    markAsRead,
    startDm,
    isChatModalOpen,
    openChat,
    closeChat,
    startDmWithUser,
    dmsUnreadCount: dmsUnread,
  }), [
    isInitialized, isInitializing, initError,
    channels, communityChannel, dmChannels, selectedChannel,
    messages, messagesLoading, usersMap,
    totalUnread, communityUnread, dmsUnread, channelUnreads,
    activeTab, isChatOpen, isConnected,
    initialize, selectChannel, setActiveTab,
    sendMessage, editMessage, deleteMessage, toggleReaction,
    refreshChannels, refreshMessages, markAsRead, startDm,
    isChatModalOpen, openChat, closeChat, startDmWithUser,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}

      <Modal
        visible={isChatModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeChat}
      >
        <View style={{ flex: 1 }}>
          {username && (
            <ChatScreen
              username={username}
              onClose={closeChat}
            />
          )}
        </View>
      </Modal>
    </ChatContext.Provider>
  );
};

export default ChatProvider;
