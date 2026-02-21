/**
 * Shared State Types for HiveSnaps
 * 
 * This file defines all the types for our shared state management system.
 * We use a Redux-like pattern with Context + Reducers for state management.
 */

// Base cache item with expiration
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// User profile from Hive blockchain
export interface UserProfile {
  name: string;
  displayName?: string;
  about?: string;
  location?: string;
  website?: string;
  profile_image?: string;
  cover_image?: string;
  reputation?: number;
  post_count?: number;
  created?: string;
  json_metadata?: string;
  posting_json_metadata?: string;
  profile_image_last_updated?: number; // Timestamp of last avatar update
  [key: string]: any;
}

export interface UserState {
  currentUser: string | null;
  hasActiveKey: boolean;
  profiles: Record<string, CacheItem<UserProfile>>;
  followingLists: Record<string, CacheItem<string[]>>;
  followerLists: Record<string, CacheItem<string[]>>;
  mutedLists: Record<string, CacheItem<string[]>>;
  loading: {
    profile: Record<string, boolean>;
    following: Record<string, boolean>;
    followers: Record<string, boolean>;
    muted: Record<string, boolean>;
  };
  errors: {
    profile: Record<string, string | null>;
    following: Record<string, string | null>;
    followers: Record<string, string | null>;
    muted: Record<string, string | null>;
  };
}

// Hive blockchain state
export interface HivePost {
  author: string;
  permlink: string;
  title?: string;
  body: string;
  category?: string;
  parent_author?: string;
  parent_permlink?: string;
  created: string;
  last_update?: string;
  depth?: number;
  children?: number;
  net_rshares?: number;
  abs_rshares?: number;
  vote_rshares?: number;
  children_abs_rshares?: number;
  cashout_time?: string;
  max_cashout_time?: string;
  total_vote_weight?: number;
  reward_weight?: number;
  total_payout_value?: string;
  curator_payout_value?: string;
  author_payout_value?: string;
  pending_payout_value?: string;
  promoted?: string;
  replies?: any[];
  author_reputation?: number;
  root_author?: string;
  root_permlink?: string;
  max_accepted_payout?: string;
  percent_hbd?: number;
  allow_replies?: boolean;
  allow_votes?: boolean;
  allow_curation_rewards?: boolean;
  beneficiaries?: any[];
  url?: string;
  root_title?: string;
  json_metadata?: string;
  posting_json_metadata?: string;
  [key: string]: any;
}

export interface HiveData {
  hivePrice: number | null;
  globalProps: any | null;
  rewardFund: any | null;
  lastUpdated: number;
}

export interface HiveState {
  data: HiveData;
  posts: Record<string, CacheItem<HivePost>>; // key: author/permlink
  postsByTag: Record<string, CacheItem<string[]>>; // key: tag, value: array of post keys
  loading: {
    data: boolean;
    posts: Record<string, boolean>;
    tags: Record<string, boolean>;
  };
  errors: {
    data: string | null;
    posts: Record<string, string | null>;
    tags: Record<string, string | null>;
  };
}

// Notification state
export interface Notification {
  id: string;
  type: 'follow' | 'unfollow' | 'vote' | 'comment' | 'mention' | 'reblog';
  from: string;
  to: string;
  timestamp: number;
  read: boolean;
  data?: {
    permlink?: string;
    author?: string;
    weight?: number;
    [key: string]: any;
  };
}

export interface NotificationState {
  notifications: CacheItem<Notification[]> | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  lastChecked: number;
}

// Authentication state
export interface AuthState {
  jwtToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  lastAuthenticated: number | null;
  loading: boolean;
  error: string | null;
}

// Root app state
export interface AppState {
  user: UserState;
  hive: HiveState;
  notifications: NotificationState;
  auth: AuthState;
}

// Action types
export type UserAction =
  | { type: 'USER_SET_CURRENT'; payload: string | null }
  | { type: 'USER_SET_HAS_ACTIVE_KEY'; payload: boolean }
  | { type: 'USER_SET_PROFILE'; payload: { username: string; profile: UserProfile } }
  | { type: 'USER_SET_FOLLOWING_LIST'; payload: { username: string; following: string[] } }
  | { type: 'USER_SET_FOLLOWER_LIST'; payload: { username: string; followers: string[] } }
  | { type: 'USER_SET_MUTED_LIST'; payload: { username: string; muted: string[] } }
  | { type: 'USER_SET_LOADING'; payload: { type: keyof UserState['loading']; username: string; loading: boolean } }
  | { type: 'USER_SET_ERROR'; payload: { type: keyof UserState['errors']; username: string; error: string | null } }
  | { type: 'USER_CLEAR_CACHE'; payload?: { username?: string; type?: keyof UserState['loading'] } }
  | { type: 'USER_INVALIDATE_FOLLOWING_CACHE'; payload: string } // username
  | { type: 'USER_INVALIDATE_MUTED_CACHE'; payload: string }; // username

export type HiveAction =
  | { type: 'HIVE_SET_DATA'; payload: Partial<HiveData> }
  | { type: 'HIVE_SET_POST'; payload: { key: string; post: HivePost } }
  | { type: 'HIVE_SET_POSTS_BY_TAG'; payload: { tag: string; postKeys: string[] } }
  | { type: 'HIVE_SET_LOADING'; payload: { type: keyof HiveState['loading']; key: string; loading: boolean } }
  | { type: 'HIVE_SET_ERROR'; payload: { type: keyof HiveState['errors']; key: string; error: string | null } }
  | { type: 'HIVE_CLEAR_CACHE'; payload?: { key?: string; type?: keyof HiveState['loading'] } };

export type NotificationAction =
  | { type: 'NOTIFICATION_SET_DATA'; payload: Notification[] }
  | { type: 'NOTIFICATION_MARK_READ'; payload: string | string[] }
  | { type: 'NOTIFICATION_SET_LOADING'; payload: boolean }
  | { type: 'NOTIFICATION_SET_ERROR'; payload: string | null }
  | { type: 'NOTIFICATION_UPDATE_UNREAD_COUNT'; payload: number }
  | { type: 'NOTIFICATION_CLEAR_CACHE' };

export type AuthAction =
  | { type: 'AUTH_SET_TOKEN'; payload: string | null }
  | { type: 'AUTH_SET_REFRESH_TOKEN'; payload: string | null }
  | { type: 'AUTH_SET_TOKENS'; payload: { token: string | null; refreshToken: string | null } }
  | { type: 'AUTH_SET_LOADING'; payload: boolean }
  | { type: 'AUTH_SET_ERROR'; payload: string | null }
  | { type: 'AUTH_CLEAR' };

export type AppAction = UserAction | HiveAction | NotificationAction | AuthAction;

// Cache configuration
export const CACHE_DURATIONS = {
  FOLLOWING_LIST: 5 * 60 * 1000, // 5 minutes
  USER_PROFILE: 10 * 60 * 1000, // 10 minutes
  NOTIFICATIONS: 2 * 60 * 1000, // 2 minutes
  HIVE_POSTS: 1 * 60 * 1000, // 1 minute
  HIVE_DATA: 2 * 60 * 1000, // 2 minutes
} as const;

// Utility type helpers
export type LoadingState<T extends Record<string, any>> = {
  [K in keyof T]: Record<string, boolean>;
};

export type ErrorState<T extends Record<string, any>> = {
  [K in keyof T]: Record<string, string | null>;
};
