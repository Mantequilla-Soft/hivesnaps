/**
 * Ecency Chat Service
 * Handles Ecency/Mattermost chat integration for HiveSnaps
 *
 * Architecture:
 * - Uses Ecency's hosted Mattermost API (no self-hosting required)
 * - Authentication via Hivesigner-style signed tokens
 * - Session managed via mm_pat token stored in SecureStore
 * - Real-time updates via WebSocket connection
 * - Supports community chat (hive-178315/Snapie) and DMs
 */

import { PrivateKey, cryptoUtils } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { ECENCY_API_BASE_URL } from '../app/config/env';

// ============================================================================
// Types
// ============================================================================

export interface EcencyChatUser {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
}

export interface EcencyChatChannel {
  id: string;
  type: 'O' | 'D'; // O = Open (community), D = Direct
  display_name: string;
  name: string;
  header?: string;
  purpose?: string;
  last_post_at?: number;
  total_msg_count?: number;
  // DM-specific
  dm_partner?: EcencyChatUser;
  // State
  is_favorite?: boolean;
  is_muted?: boolean;
  unread_count?: number;
  mention_count?: number;
}

export interface EcencyChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  create_at: number;
  update_at: number;
  delete_at?: number;
  root_id?: string; // For threaded replies
  // Resolved username (from users map)
  username?: string;
  // Reactions
  metadata?: {
    reactions?: Record<string, string[]>; // emoji_name -> user_ids
  };
}

export interface EcencyChatReaction {
  emoji_name: string;
  user_id: string;
  post_id: string;
  create_at: number;
}

export interface BootstrapResponse {
  ok: boolean;
  userId?: string;
  channelId?: string; // Community channel ID if community was provided
  token?: string; // Auth token for REST and WebSocket
  error?: string;
}

export interface ChannelsResponse {
  channels: EcencyChatChannel[];
}

export interface MessagesResponse {
  posts: EcencyChatMessage[];
  users: Record<string, EcencyChatUser>; // user_id -> user info
  order: string[]; // Ordered post IDs
}

// Ecency API response format for /channels/unreads
export interface UnreadChannelItem {
  channelId: string;
  type: 'O' | 'D';  // O = Open/community, D = Direct message
  mention_count: number;
  message_count: number;
}

export interface UnreadResponse {
  channels: UnreadChannelItem[];
  totalMentions: number;
  totalDMs: number;      // Total unread DM messages
  totalUnread: number;   // Total unread across all channels
}

// WebSocket event types from Mattermost
export type WebSocketEventType =
  | 'hello'
  | 'posted'
  | 'post_edited'
  | 'post_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'typing'
  | 'user_updated';

export interface WebSocketEvent {
  event: WebSocketEventType;
  data: Record<string, any>;
  broadcast?: {
    channel_id?: string;
    user_id?: string;
  };
  seq?: number;
}

export type WebSocketListener = (event: WebSocketEvent) => void;

// ============================================================================
// Constants
// ============================================================================

const HIVESIGNER_APP_ID = 'ecency.app'; // Ecency's Hivesigner app ID
const SNAPIE_COMMUNITY = 'hive-178315';
const SNAPIE_COMMUNITY_TITLE = 'Snapie';
const MM_PAT_KEY = 'ecency_mm_pat';
const MM_USER_ID_KEY = 'ecency_mm_user_id';
const MM_CHANNEL_ID_KEY = 'ecency_mm_channel_id';

// WebSocket
const WS_BASE_URL = ECENCY_API_BASE_URL.replace(/^http/, 'ws');
const MAX_RECONNECT_DELAY = 30000; // 30s cap

// Emoji mappings for Mattermost
const EMOJI_TO_NAME: Record<string, string> = {
  '👍': '+1',
  '👎': '-1',
  '❤️': 'heart',
  '😂': 'laughing',
  '😮': 'open_mouth',
  '😢': 'cry',
  '🔥': 'fire',
  '🎉': 'tada',
  '👀': 'eyes',
  '🙏': 'pray',
};

const NAME_TO_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_TO_NAME).map(([k, v]) => [v, k])
);

// ============================================================================
// WebSocket Manager
// ============================================================================

class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<WebSocketListener>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(token: string): void {
    this.token = token;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    if (!this.token) return;

    // Clean up existing socket
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      try { this.socket.close(); } catch {}
      this.socket = null;
    }

    const url = `${WS_BASE_URL}/websocket?token=${this.token}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      if (__DEV__) {
        console.log('[WebSocketManager] Connected');
      }
    };

    this.socket.onmessage = (e: WebSocketMessageEvent) => {
      try {
        const event: WebSocketEvent = JSON.parse(e.data);

        if (event.event === 'hello') {
          this._isConnected = true;
          this.reconnectAttempts = 0;
          this.emit(event);
          return;
        }

        // Parse data.post if it's a JSON string (posted/post_edited events)
        if (event.data?.post && typeof event.data.post === 'string') {
          try {
            event.data.post = JSON.parse(event.data.post);
          } catch {}
        }

        this.emit(event);
      } catch {
        // Ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      this._isConnected = false;
      if (__DEV__) {
        console.log('[WebSocketManager] Disconnected, scheduling reconnect');
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose will fire after this, which handles reconnect
    };
  }

  private scheduleReconnect(): void {
    if (!this.token) return; // Don't reconnect if disconnected intentionally

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;

    if (__DEV__) {
      console.log(`[WebSocketManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  disconnect(): void {
    this.token = null;
    this._isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.onclose = null; // Prevent reconnect
      this.socket.close();
      this.socket = null;
    }

    this.listeners.clear();
  }

  on(event: WebSocketEventType | '*', callback: WebSocketListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: WebSocketEvent): void {
    // Notify specific event listeners
    this.listeners.get(event.event)?.forEach(cb => cb(event));
    // Notify wildcard listeners
    this.listeners.get('*')?.forEach(cb => cb(event));
  }

  /** Force reconnect (e.g., on app foreground) */
  reconnect(): void {
    if (this.token && !this._isConnected) {
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.doConnect();
    }
  }
}

// ============================================================================
// Service Implementation
// ============================================================================

class EcencyChatServiceImpl {
  private readonly DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  private mmPat: string | null = null;
  private userId: string | null = null;
  private communityChannelId: string | null = null;
  readonly ws = new WebSocketManager();

  // --------------------------------------------------------------------------
  // Token Generation
  // --------------------------------------------------------------------------

  /**
   * Build Hivesigner-style access token for Ecency authentication
   * This is the key to authenticating without Keychain - we sign directly with the posting key
   */
  buildAccessToken(username: string, postingWif: string): string {
    const timestamp = Math.floor(Date.now() / 1000);

    const payload: any = {
      signed_message: { type: 'code', app: HIVESIGNER_APP_ID },
      authors: [username],
      timestamp,
    };

    const message = JSON.stringify(payload);
    const hash = cryptoUtils.sha256(message);

    // Sign with posting key
    const signature = PrivateKey.fromString(postingWif).sign(hash).toString();

    // Attach signature
    payload.signatures = [signature];

    // Base64url encode (RN doesn't support 'base64url', so we convert manually)
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    // Convert to URL-safe base64: replace + with -, / with _, remove trailing =
    const token = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (this.DEBUG) {
      console.log('[EcencyChatService] Built access token for:', username);
    }

    return token;
  }

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  /**
   * Initialize chat session - must be called before other methods
   * Returns bootstrap result with token for WebSocket connection
   */
  async bootstrap(): Promise<BootstrapResponse> {
    try {
      // Get credentials from SecureStore
      const username = await SecureStore.getItemAsync('hive_username');
      const postingKey = await SecureStore.getItemAsync('hive_posting_key');

      if (!username || !postingKey) {
        return { ok: false, error: 'Not logged in - missing credentials' };
      }

      // Check if we have a cached session
      const cachedPat = await SecureStore.getItemAsync(MM_PAT_KEY);
      const cachedUserId = await SecureStore.getItemAsync(MM_USER_ID_KEY);
      const cachedChannelId = await SecureStore.getItemAsync(MM_CHANNEL_ID_KEY);

      if (cachedPat && cachedUserId && cachedChannelId) {
        this.mmPat = cachedPat;
        this.userId = cachedUserId;
        this.communityChannelId = cachedChannelId;

        // Verify session is still valid by fetching channels
        try {
          const channels = await this.getChannels();
          // Verify the cached channel exists and is the Snapie channel
          const snapieChannel = channels.find(c => c.id === cachedChannelId);
          if (snapieChannel) {
            if (this.DEBUG) {
              console.log('[EcencyChatService] Using cached session, channelId:', cachedChannelId);
            }
            return { ok: true, userId: cachedUserId, channelId: cachedChannelId, token: cachedPat };
          } else {
            if (this.DEBUG) {
              console.log('[EcencyChatService] Cached channel not found in channel list, re-bootstrapping');
            }
          }
        } catch {
          if (this.DEBUG) {
            console.log('[EcencyChatService] Cached session expired, re-bootstrapping');
          }
        }
      }

      // Build access token
      const accessToken = this.buildAccessToken(username, postingKey);

      // Call bootstrap endpoint
      const response = await fetch(`${ECENCY_API_BASE_URL}/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          accessToken,
          displayName: username,
          community: SNAPIE_COMMUNITY,
          communityTitle: SNAPIE_COMMUNITY_TITLE,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EcencyChatService] Bootstrap failed:', response.status, errorText);
        return { ok: false, error: `Bootstrap failed: ${response.status}` };
      }

      const data = await response.json();

      if (!data.ok) {
        return { ok: false, error: data.error || 'Bootstrap returned not ok' };
      }

      // Extract token: prefer response body token, fall back to cookie
      let mmPat: string | null = data.token || data.mm_pat || null;

      if (!mmPat) {
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          const match = setCookie.match(/mm_pat=([^;]+)/);
          if (match) {
            mmPat = match[1];
          }
        }
      }

      if (!mmPat) {
        console.error('[EcencyChatService] No auth token received from bootstrap');
        return { ok: false, error: 'No auth token received from bootstrap' };
      }

      // Store session data
      this.mmPat = mmPat;
      this.userId = data.userId;
      this.communityChannelId = data.channelId;

      // Persist to SecureStore
      await SecureStore.setItemAsync(MM_PAT_KEY, mmPat);
      if (data.userId) {
        await SecureStore.setItemAsync(MM_USER_ID_KEY, data.userId);
      }
      if (data.channelId) {
        await SecureStore.setItemAsync(MM_CHANNEL_ID_KEY, data.channelId);
      }

      if (this.DEBUG) {
        console.log('[EcencyChatService] Bootstrap successful:', {
          userId: data.userId,
          channelId: data.channelId,
          hasToken: true,
        });
      }

      return {
        ok: true,
        userId: data.userId,
        channelId: data.channelId,
        token: mmPat,
      };
    } catch (error) {
      console.error('[EcencyChatService] Bootstrap error:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown bootstrap error',
      };
    }
  }

  /**
   * Clear chat session (on logout)
   */
  async clearSession(): Promise<void> {
    this.mmPat = null;
    this.userId = null;
    this.communityChannelId = null;
    this.ws.disconnect();

    await SecureStore.deleteItemAsync(MM_PAT_KEY);
    await SecureStore.deleteItemAsync(MM_USER_ID_KEY);
    await SecureStore.deleteItemAsync(MM_CHANNEL_ID_KEY);

    if (this.DEBUG) {
      console.log('[EcencyChatService] Session cleared');
    }
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return !!this.userId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Get Snapie community channel ID
   */
  getCommunityChannelId(): string | null {
    return this.communityChannelId;
  }

  /**
   * Get the auth token (for WebSocket connection)
   */
  getToken(): string | null {
    return this.mmPat;
  }

  // --------------------------------------------------------------------------
  // API Request Helper
  // --------------------------------------------------------------------------

  private async makeRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Use Bearer token auth (works reliably in React Native, unlike Cookie)
    if (this.mmPat) {
      headers['Authorization'] = `Bearer ${this.mmPat}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const url = `${ECENCY_API_BASE_URL}${path}`;

    if (this.DEBUG) {
      console.log(`[EcencyChatService] ${method} ${path}`);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Channels
  // --------------------------------------------------------------------------

  async getChannels(): Promise<EcencyChatChannel[]> {
    const data = await this.makeRequest<{ channels: EcencyChatChannel[] }>('/channels');
    return data.channels || [];
  }

  async getUnreadCounts(): Promise<UnreadResponse> {
    if (!this.userId) {
      if (this.DEBUG) {
        console.log('[EcencyChatService] No userId, cannot fetch unreads');
      }
      return { channels: [], totalMentions: 0, totalDMs: 0, totalUnread: 0 };
    }

    try {
      const response = await this.makeRequest<UnreadResponse>('/channels/unreads');

      return {
        channels: response.channels || [],
        totalMentions: response.totalMentions || 0,
        totalDMs: response.totalDMs || 0,
        totalUnread: response.totalUnread || 0
      };
    } catch (e) {
      if (this.DEBUG) {
        console.log('[EcencyChatService] Failed to get unreads:', e);
      }
      return { channels: [], totalMentions: 0, totalDMs: 0, totalUnread: 0 };
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/join`, 'POST');
  }

  async leaveChannel(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/leave`, 'POST');
  }

  async markChannelViewed(channelId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/view`, 'POST');
  }

  async setChannelFavorite(channelId: string, favorite: boolean): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/favorite`, 'POST', { favorite });
  }

  async setChannelMuted(channelId: string, mute: boolean): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/mute`, 'POST', { mute });
  }

  // --------------------------------------------------------------------------
  // Messages
  // --------------------------------------------------------------------------

  async getMessages(channelId: string): Promise<MessagesResponse> {
    const data = await this.makeRequest<MessagesResponse>(`/channels/${channelId}/posts`);

    // Enrich messages with usernames from users map
    if (data.posts && data.users) {
      data.posts = data.posts.map(post => ({
        ...post,
        username: data.users[post.user_id]?.username || 'Unknown',
      }));
    }

    return data;
  }

  async sendMessage(channelId: string, message: string, rootId?: string): Promise<EcencyChatMessage> {
    const body: any = { message };
    if (rootId) {
      body.rootId = rootId;
    }

    return this.makeRequest<EcencyChatMessage>(`/channels/${channelId}/posts`, 'POST', body);
  }

  async editMessage(channelId: string, postId: string, message: string): Promise<EcencyChatMessage> {
    return this.makeRequest<EcencyChatMessage>(
      `/channels/${channelId}/posts/${postId}`,
      'PATCH',
      { message }
    );
  }

  async deleteMessage(channelId: string, postId: string): Promise<void> {
    await this.makeRequest(`/channels/${channelId}/posts/${postId}`, 'DELETE');
  }

  // --------------------------------------------------------------------------
  // Reactions
  // --------------------------------------------------------------------------

  async toggleReaction(channelId: string, postId: string, emoji: string, add: boolean): Promise<void> {
    const emojiName = EMOJI_TO_NAME[emoji] || emoji;
    await this.makeRequest(
      `/channels/${channelId}/posts/${postId}/reactions`,
      'POST',
      { emoji: emojiName, add }
    );
  }

  emojiNameToChar(name: string): string {
    return NAME_TO_EMOJI[name] || name;
  }

  emojiCharToName(char: string): string {
    return EMOJI_TO_NAME[char] || char;
  }

  // --------------------------------------------------------------------------
  // Direct Messages
  // --------------------------------------------------------------------------

  async createDirectChannel(username: string): Promise<EcencyChatChannel> {
    const response = await this.makeRequest<any>('/direct', 'POST', { username });

    if (__DEV__) {
      console.log('[EcencyChatService] createDirectChannel response:', JSON.stringify(response, null, 2));
    }

    if (response?.id) {
      return response as EcencyChatChannel;
    }
    if (response?.channel?.id) {
      return response.channel as EcencyChatChannel;
    }
    if (response?.data?.id) {
      return response.data as EcencyChatChannel;
    }

    return response;
  }

  async searchUsers(query: string): Promise<EcencyChatUser[]> {
    const data = await this.makeRequest<{ users: EcencyChatUser[] }>(
      `/users/search?q=${encodeURIComponent(query)}`
    );
    return data.users || [];
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  async searchMessages(term: string): Promise<EcencyChatMessage[]> {
    const data = await this.makeRequest<{ posts: EcencyChatMessage[] }>(
      '/search/posts',
      'POST',
      { term }
    );
    return data.posts || [];
  }

  async searchChannels(term: string): Promise<EcencyChatChannel[]> {
    const data = await this.makeRequest<{ channels: EcencyChatChannel[] }>(
      '/channels/search',
      'POST',
      { term }
    );
    return data.channels || [];
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return 'now';
    }
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Export singleton instance
export const ecencyChatService = new EcencyChatServiceImpl();
