/**
 * Ecency Chat Hook
 * Manages chat state, session lifecycle, WebSocket subscriptions, and UI interactions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  ecencyChatService,
  EcencyChatChannel,
  EcencyChatMessage,
  EcencyChatUser,
  WebSocketEvent,
} from '../services/ecencyChatService';

// ============================================================================
// Types
// ============================================================================

export interface ChatTab {
  id: 'community' | 'dms';
  label: string;
}

export interface StartDmResult {
  success: boolean;
  channel?: EcencyChatChannel;
  error?: string;
  errorType?: 'not_on_chat' | 'network' | 'unknown';
}

export interface UseEcencyChatResult {
  // Session state
  isInitialized: boolean;
  isInitializing: boolean;
  initError: string | null;

  // Channels
  channels: EcencyChatChannel[];
  communityChannel: EcencyChatChannel | null;
  dmChannels: EcencyChatChannel[];
  selectedChannel: EcencyChatChannel | null;

  // Messages
  messages: EcencyChatMessage[];
  messagesLoading: boolean;
  usersMap: Record<string, EcencyChatUser>;

  // Unread counts
  totalUnread: number;
  communityUnread: number;
  dmsUnread: number;
  channelUnreads: Record<string, number>;

  // UI state
  activeTab: ChatTab['id'];
  isChatOpen: boolean;
  isConnected: boolean;

  // Actions
  initialize: () => Promise<boolean>;
  selectChannel: (channel: EcencyChatChannel | null) => void;
  setActiveTab: (tab: ChatTab['id']) => void;

  // Message actions
  sendMessage: (message: string, rootId?: string) => Promise<boolean>;
  editMessage: (postId: string, message: string) => Promise<boolean>;
  deleteMessage: (postId: string) => Promise<boolean>;
  toggleReaction: (postId: string, emoji: string) => Promise<boolean>;

  // Channel actions
  refreshChannels: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  markAsRead: () => Promise<void>;
  startDm: (username: string) => Promise<StartDmResult>;
}

// ============================================================================
// Constants
// ============================================================================

// Light fallback poll for unread count sync only (safety net)
const UNREAD_SYNC_INTERVAL = 60000; // 60 seconds

export const CHAT_TABS: ChatTab[] = [
  { id: 'community', label: 'Snapie Community' },
  { id: 'dms', label: 'Private Messages' },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export const useEcencyChat = (
  username: string | null,
  isChatOpen: boolean = false
): UseEcencyChatResult => {
  // Session state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Channels state
  const [channels, setChannels] = useState<EcencyChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<EcencyChatChannel | null>(null);
  const [snapieChannelId, setSnapieChannelId] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<EcencyChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, EcencyChatUser>>({});

  // Unread counts
  const [totalUnread, setTotalUnread] = useState(0);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [dmsUnread, setDmsUnread] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>({});

  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<ChatTab['id']>('community');

  // Refs
  const selectedChannelRef = useRef<EcencyChatChannel | null>(null);
  const usersMapRef = useRef<Record<string, EcencyChatUser>>({});
  const channelsRef = useRef<EcencyChatChannel[]>([]);
  const unreadSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializedRef = useRef(false);

  // Keep refs in sync
  selectedChannelRef.current = selectedChannel;
  usersMapRef.current = usersMap;
  channelsRef.current = channels;
  isInitializedRef.current = isInitialized;

  // --------------------------------------------------------------------------
  // Derived State
  // --------------------------------------------------------------------------

  const communityChannel = snapieChannelId
    ? channels.find(c => c.id === snapieChannelId) || null
    : null;
  const dmChannels = channels.filter(c => c.type === 'D');

  // --------------------------------------------------------------------------
  // Unread Count Sync
  // --------------------------------------------------------------------------

  const syncUnreadCounts = useCallback(async () => {
    if (!isInitializedRef.current) return;

    try {
      const unreads = await ecencyChatService.getUnreadCounts();
      const dmUnread = unreads.totalDMs || 0;
      const total = unreads.totalUnread || 0;

      setTotalUnread(total);
      setCommunityUnread(Math.max(0, total - dmUnread));
      setDmsUnread(dmUnread);

      const perChannel: Record<string, number> = {};
      if (unreads.channels && Array.isArray(unreads.channels)) {
        for (const ch of unreads.channels) {
          perChannel[ch.channelId] = ch.message_count || 0;
        }
      }
      setChannelUnreads(perChannel);
    } catch (error) {
      if (__DEV__) {
        console.log('[useEcencyChat] Unread sync error:', error);
      }
    }
  }, []);

  // --------------------------------------------------------------------------
  // Message Operations
  // --------------------------------------------------------------------------

  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) {
      console.warn('[useEcencyChat] loadMessages called with no channelId');
      return;
    }

    setMessagesLoading(true);

    try {
      const data = await ecencyChatService.getMessages(channelId);
      setMessages(data.posts || []);
      setUsersMap(prev => ({ ...prev, ...(data.users || {}) }));
    } catch (error) {
      console.error('[useEcencyChat] Load messages error:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // WebSocket Event Handlers
  // --------------------------------------------------------------------------

  const handleWsPosted = useCallback((event: WebSocketEvent) => {
    const post = event.data?.post;
    const channelId = event.broadcast?.channel_id || post?.channel_id;

    if (!post || !channelId) return;

    // Resolve username from sender_name or users map
    const senderName = event.data?.sender_name;
    const enrichedPost: EcencyChatMessage = {
      ...post,
      username: senderName || usersMapRef.current[post.user_id]?.username || 'Unknown',
    };

    // If this message is for the currently viewed channel, append it
    if (selectedChannelRef.current?.id === channelId) {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === enrichedPost.id)) return prev;
        return [...prev, enrichedPost];
      });
    } else {
      // Message for another channel — bump unread counts
      setChannelUnreads(prev => ({
        ...prev,
        [channelId]: (prev[channelId] || 0) + 1,
      }));
      setTotalUnread(prev => prev + 1);

      // Also bump the appropriate tab badge (DM vs community)
      const channel = channelsRef.current.find(c => c.id === channelId);
      if (channel?.type === 'D') {
        setDmsUnread(prev => prev + 1);
      } else {
        setCommunityUnread(prev => prev + 1);
      }
    }
  }, []);

  const handleWsPostEdited = useCallback((event: WebSocketEvent) => {
    const post = event.data?.post;
    if (!post) return;

    setMessages(prev =>
      prev.map(m => m.id === post.id ? { ...m, ...post, username: m.username } : m)
    );
  }, []);

  const handleWsPostDeleted = useCallback((event: WebSocketEvent) => {
    const postId = event.data?.post?.id;
    if (!postId) return;

    setMessages(prev => prev.filter(m => m.id !== postId));
  }, []);

  const handleWsReaction = useCallback((event: WebSocketEvent) => {
    const { emoji_name, post_id, user_id } = event.data || {};
    if (!emoji_name || !post_id) return;

    const isAdd = event.event === 'reaction_added';

    setMessages(prev =>
      prev.map(m => {
        if (m.id !== post_id) return m;
        const reactions: Record<string, unknown> = { ...(m.metadata?.reactions || {}) };
        const existing = reactions[emoji_name];
        const users: string[] = Array.isArray(existing) ? [...existing] : [];

        if (isAdd && !users.includes(user_id)) {
          users.push(user_id);
        } else if (!isAdd) {
          const idx = users.indexOf(user_id);
          if (idx >= 0) users.splice(idx, 1);
        }

        if (users.length > 0) {
          reactions[emoji_name] = users;
        } else {
          delete reactions[emoji_name];
        }

        return { ...m, metadata: { ...m.metadata, reactions } };
      })
    );
  }, []);

  const handleWsHello = useCallback(() => {
    setIsConnected(true);
    if (__DEV__) {
      console.log('[useEcencyChat] WebSocket connected (hello received)');
    }
  }, []);

  const handleWsDisconnect = useCallback(() => {
    setIsConnected(false);
    if (__DEV__) {
      console.log('[useEcencyChat] WebSocket disconnected');
    }
  }, []);

  // --------------------------------------------------------------------------
  // WebSocket Lifecycle
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized) return;

    const token = ecencyChatService.getToken();
    if (!token) return;

    // Connect WebSocket
    ecencyChatService.ws.connect(token);

    // Subscribe to events
    const unsubs = [
      ecencyChatService.ws.on('hello', handleWsHello),
      ecencyChatService.ws.on('disconnect', handleWsDisconnect),
      ecencyChatService.ws.on('posted', handleWsPosted),
      ecencyChatService.ws.on('post_edited', handleWsPostEdited),
      ecencyChatService.ws.on('post_deleted', handleWsPostDeleted),
      ecencyChatService.ws.on('reaction_added', handleWsReaction),
      ecencyChatService.ws.on('reaction_removed', handleWsReaction),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
      ecencyChatService.ws.disconnect();
      setIsConnected(false);
    };
  }, [isInitialized, handleWsHello, handleWsDisconnect, handleWsPosted, handleWsPostEdited, handleWsPostDeleted, handleWsReaction]);

  // --------------------------------------------------------------------------
  // App State: reconnect on foreground, sync unreads
  // --------------------------------------------------------------------------

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isInitializedRef.current) {
        // App came to foreground — reconnect WS if needed and sync unreads
        ecencyChatService.ws.reconnect();
        syncUnreadCounts();
      }
    });

    return () => subscription.remove();
  }, [syncUnreadCounts]);

  // --------------------------------------------------------------------------
  // Unread sync fallback poll (60s safety net)
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized) return;

    // Initial sync
    syncUnreadCounts();

    unreadSyncTimer.current = setInterval(syncUnreadCounts, UNREAD_SYNC_INTERVAL);

    return () => {
      if (unreadSyncTimer.current) {
        clearInterval(unreadSyncTimer.current);
        unreadSyncTimer.current = null;
      }
    };
  }, [isInitialized, syncUnreadCounts]);

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!username) {
      setInitError('Not logged in');
      return false;
    }

    setIsInitializing(true);
    setInitError(null);

    try {
      const result = await ecencyChatService.bootstrap();

      if (result.ok) {
        setIsInitialized(true);

        const snapieId = result.channelId;
        if (snapieId) {
          setSnapieChannelId(snapieId);
        }

        // Load channels immediately after init
        const channelsList = await ecencyChatService.getChannels();
        setChannels(channelsList);

        // Sync unread counts
        await syncUnreadCounts();

        // Auto-select Snapie community channel
        const snapieChannel = channelsList.find(c => c.id === snapieId);
        if (snapieChannel) {
          setSelectedChannel(snapieChannel);
          if (__DEV__) {
            console.log('[useEcencyChat] Selected Snapie channel:', snapieId);
          }
        } else if (__DEV__) {
          console.warn('[useEcencyChat] Snapie channel not found in channel list:', snapieId);
        }

        if (__DEV__) {
          console.log('[useEcencyChat] Initialized successfully');
        }
        return true;
      } else {
        setInitError(result.error || 'Bootstrap failed');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setInitError(errorMsg);
      console.error('[useEcencyChat] Initialize error:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [username, syncUnreadCounts]);

  // Clear session on logout
  useEffect(() => {
    if (!username && isInitialized) {
      ecencyChatService.clearSession();
      setIsInitialized(false);
      setChannels([]);
      setMessages([]);
      setSelectedChannel(null);
      setTotalUnread(0);
      setCommunityUnread(0);
      setDmsUnread(0);
      setIsConnected(false);
    }
  }, [username, isInitialized]);

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  const selectChannel = useCallback((channel: EcencyChatChannel | null) => {
    setMessages([]);
    setMessagesLoading(true);
    setSelectedChannel(channel);

    if (channel?.id) {
      loadMessages(channel.id);
    } else {
      setMessagesLoading(false);
    }
  }, [loadMessages]);

  const refreshChannels = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const channelsList = await ecencyChatService.getChannels();
      setChannels(channelsList);
      await syncUnreadCounts();
    } catch (error) {
      console.error('[useEcencyChat] Refresh channels error:', error);
    }
  }, [isInitialized, syncUnreadCounts]);

  const markAsRead = useCallback(async () => {
    if (!selectedChannel?.id) return;

    try {
      await ecencyChatService.markChannelViewed(selectedChannel.id);
      // Only sync unreads, don't refresh everything
      await syncUnreadCounts();
    } catch (error) {
      console.error('[useEcencyChat] Mark as read error:', error);
    }
  }, [selectedChannel, syncUnreadCounts]);

  const startDm = useCallback(async (targetUsername: string): Promise<StartDmResult> => {
    if (!isInitialized) {
      return { success: false, error: 'Chat not initialized', errorType: 'unknown' };
    }

    try {
      const channel = await ecencyChatService.createDirectChannel(targetUsername);

      if (!channel?.id) {
        console.warn('[useEcencyChat] Created DM channel has no ID');
        return { success: false, error: 'Invalid channel response', errorType: 'unknown' };
      }

      await refreshChannels();
      setActiveTab('dms');
      setSelectedChannel(channel);
      loadMessages(channel.id);

      return { success: true, channel };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not on Ecency chat') || errorMessage.includes('404')) {
        const match = errorMessage.match(/@(\w+) is not on Ecency chat/);
        const uname = match ? match[1] : targetUsername;
        return {
          success: false,
          error: `@${uname} hasn't joined Ecency chat yet. They need to sign in to Ecency chat before you can message them.`,
          errorType: 'not_on_chat',
        };
      }

      console.error('[useEcencyChat] Start DM error:', error);

      return {
        success: false,
        error: 'Failed to start conversation. Please try again.',
        errorType: 'network',
      };
    }
  }, [isInitialized, refreshChannels, loadMessages]);

  // --------------------------------------------------------------------------
  // More Message Operations
  // --------------------------------------------------------------------------

  const refreshMessages = useCallback(async () => {
    if (!selectedChannel?.id) return;
    await loadMessages(selectedChannel.id);
  }, [selectedChannel, loadMessages]);

  const sendMessage = useCallback(async (message: string, rootId?: string): Promise<boolean> => {
    if (!selectedChannel || !message.trim()) return false;

    try {
      await ecencyChatService.sendMessage(selectedChannel.id, message, rootId);
      // WebSocket will deliver the message back via 'posted' event
      // No need to refreshMessages — it arrives in real-time
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Send message error:', error);
      return false;
    }
  }, [selectedChannel]);

  const editMessage = useCallback(async (postId: string, message: string): Promise<boolean> => {
    if (!selectedChannel) return false;

    try {
      await ecencyChatService.editMessage(selectedChannel.id, postId, message);
      // WebSocket 'post_edited' event will update state
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Edit message error:', error);
      return false;
    }
  }, [selectedChannel]);

  const deleteMessage = useCallback(async (postId: string): Promise<boolean> => {
    if (!selectedChannel) return false;

    try {
      await ecencyChatService.deleteMessage(selectedChannel.id, postId);
      // WebSocket 'post_deleted' event will update state
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Delete message error:', error);
      return false;
    }
  }, [selectedChannel]);

  const toggleReaction = useCallback(async (postId: string, emoji: string): Promise<boolean> => {
    if (!selectedChannel) return false;

    try {
      const message = messages.find(m => m.id === postId);
      const userId = ecencyChatService.getUserId();
      const emojiName = ecencyChatService.emojiCharToName(emoji);
      const reactionUsers = message?.metadata?.reactions?.[emojiName];
      const hasReaction = Array.isArray(reactionUsers) && reactionUsers.includes(userId || '');

      await ecencyChatService.toggleReaction(selectedChannel.id, postId, emoji, !hasReaction);
      // WebSocket 'reaction_added/removed' event will update state
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Toggle reaction error:', error);
      return false;
    }
  }, [selectedChannel, messages]);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
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
  };
};
