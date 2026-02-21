/**
 * App Store Context - Provides shared state management using React Context and useReducer
 * This replaces the need for Redux and provides a lighter-weight state management solution
 * with efficient caching and automatic expiration handling
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppAction, UserProfile } from './types';
import { appReducer, initialAppState, appSelectors } from './reducer';
import { userSelectors } from './userSlice';
import { hiveSelectors } from './hiveSlice';
import { notificationSelectors } from './notificationSlice';
import { authSelectors } from './authSlice';
import { SessionService } from '../services/SessionService';
import { authService } from '../services/AuthService';

// Context type
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  // User actions
  setCurrentUser: (username: string | null) => void;
  setHasActiveKey: (hasActiveKey: boolean) => void;
  setUserProfile: (username: string, profile: UserProfile) => void;
  setFollowingList: (username: string, following: string[]) => void;
  setFollowerList: (username: string, followers: string[]) => void;
  setMutedList: (username: string, muted: string[]) => void;
  setUserLoading: (type: keyof AppState['user']['loading'], username: string, loading: boolean) => void;
  setUserError: (type: keyof AppState['user']['errors'], username: string, error: string | null) => void;
  invalidateFollowingCache: (username: string) => void;
  invalidateMutedCache: (username: string) => void;
  clearUserCache: (username?: string, type?: keyof AppState['user']['loading']) => void;

  // Hive actions
  setHiveData: (data: Partial<AppState['hive']['data']>) => void;
  setHivePost: (author: string, permlink: string, post: any) => void;
  setHiveLoading: (type: keyof AppState['hive']['loading'], key: string, loading: boolean) => void;

  // Notification actions
  setNotifications: (notifications: any[]) => void;
  markNotificationsRead: (ids: string | string[]) => void;
  setNotificationLoading: (loading: boolean) => void;
  setNotificationUnreadCount: (count: number) => void;

  // Auth actions
  setAuthToken: (token: string | null) => void;
  setAuthRefreshToken: (refreshToken: string | null) => void;
  setAuthTokens: (tokens: { token: string | null; refreshToken: string | null }) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  clearAuth: () => void;

  // Selectors (memoized)
  selectors: {
    // User selectors
    getCurrentUser: () => string | null;
    getHasActiveKey: () => boolean;
    getUserProfile: (username: string) => UserProfile | null;
    getFollowingList: (username: string) => string[] | null;
    getMutedList: (username: string) => string[] | null;
    isFollowing: (follower: string, following: string) => boolean | null;
    isMuted: (muter: string, muted: string) => boolean | null;
    isUserLoading: (type: keyof AppState['user']['loading'], username: string) => boolean;
    needsUserRefresh: {
      profile: (username: string) => boolean;
      following: (username: string) => boolean;
      muted: (username: string) => boolean;
    };

    // Hive selectors
    getHiveData: () => AppState['hive']['data'];
    needsHiveDataRefresh: () => boolean;
    getPost: (author: string, permlink: string) => any | null;
    needsPostRefresh: (author: string, permlink: string) => boolean;

    // Notification selectors
    getNotifications: () => any[] | null;
    getUnreadCount: () => number;
    needsNotificationRefresh: () => boolean;

    // Auth selectors
    getAuthToken: () => string | null;
    getAuthRefreshToken: () => string | null;
    isAuthenticated: () => boolean;
    isAuthLoading: () => boolean;
    getAuthError: () => string | null;
    isAuthenticationFresh: () => boolean;

    // Cross-slice selectors
    getCurrentUserFollowing: () => string[] | null;
    doesCurrentUserFollow: (username: string) => boolean | null;
    isAnyLoading: () => boolean;
    getCacheStats: () => any;
  };
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('🚀 [AppProvider] Starting initialization...');
  console.log('🚀 [AppProvider] appReducer type:', typeof appReducer);
  console.log('🚀 [AppProvider] initialAppState:', JSON.stringify(initialAppState, null, 2));

  const [state, dispatch] = useReducer(appReducer, initialAppState);
  console.log('🚀 [AppProvider] useReducer successful');

  // Initialize current user from SecureStore on app mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        if (storedUsername) {
          console.log('🔐 [AppProvider] Loaded username from SecureStore:', storedUsername);
          dispatch({ type: 'USER_SET_CURRENT', payload: storedUsername });
        } else {
          console.log('🔐 [AppProvider] No stored username found');
        }
      } catch (error) {
        console.error('🔐 [AppProvider] Error loading username from SecureStore:', error);
      }
    };

    initializeUser();
  }, []); // Only run on mount

  // 🔍 Debug: Track provider initialization
  useEffect(() => {
    console.log('🏗️ [AppProvider] Provider initialized/re-initialized');
    console.log('🏗️ [AppProvider] Initial user state:', state.user);
  }, []); // Empty dependency - only runs on mount

  // 🔍 Debug: Track state changes (simplified)
  useEffect(() => {
    try {
      console.log('🔄 [AppProvider] State changed - basic check');
      console.log('🔄 [AppProvider] State exists:', !!state);
      console.log('🔄 [AppProvider] User state exists:', !!state?.user);
      if (state?.user) {
        console.log('🔄 [AppProvider] User profiles:', Object.keys(state.user.profiles || {}).length);
        console.log('🔄 [AppProvider] Following lists:', Object.keys(state.user.followingLists || {}).length);
      }
    } catch (err) {
      console.error('🔄 [AppProvider] Error in state debug:', err);
    }
  }, [state]);

  // User action creators
  const setCurrentUser = useCallback((username: string | null) => {
    dispatch({ type: 'USER_SET_CURRENT', payload: username });
  }, []);

  const setHasActiveKey = useCallback((hasActiveKey: boolean) => {
    dispatch({ type: 'USER_SET_HAS_ACTIVE_KEY', payload: hasActiveKey });
  }, []);

  const setUserProfile = useCallback((username: string, profile: UserProfile) => {
    dispatch({ type: 'USER_SET_PROFILE', payload: { username, profile } });
  }, []);

  const setFollowingList = useCallback((username: string, following: string[]) => {
    dispatch({ type: 'USER_SET_FOLLOWING_LIST', payload: { username, following } });
  }, []);

  const setFollowerList = useCallback((username: string, followers: string[]) => {
    dispatch({ type: 'USER_SET_FOLLOWER_LIST', payload: { username, followers } });
  }, []);

  const setMutedList = useCallback((username: string, muted: string[]) => {
    dispatch({ type: 'USER_SET_MUTED_LIST', payload: { username, muted } });
  }, []);

  const setUserLoading = useCallback((type: keyof AppState['user']['loading'], username: string, loading: boolean) => {
    dispatch({ type: 'USER_SET_LOADING', payload: { type, username, loading } });
  }, []);

  const setUserError = useCallback((type: keyof AppState['user']['errors'], username: string, error: string | null) => {
    dispatch({ type: 'USER_SET_ERROR', payload: { type, username, error } });
  }, []);

  const invalidateFollowingCache = useCallback((username: string) => {
    dispatch({ type: 'USER_INVALIDATE_FOLLOWING_CACHE', payload: username });
  }, []);

  const invalidateMutedCache = useCallback((username: string) => {
    dispatch({ type: 'USER_INVALIDATE_MUTED_CACHE', payload: username });
  }, []);

  const clearUserCache = useCallback((username?: string, type?: keyof AppState['user']['loading']) => {
    dispatch({ type: 'USER_CLEAR_CACHE', payload: username || type ? { username, type } : undefined });
  }, []);

  // Hive action creators
  const setHiveData = useCallback((data: Partial<AppState['hive']['data']>) => {
    dispatch({ type: 'HIVE_SET_DATA', payload: data });
  }, []);

  const setHivePost = useCallback((author: string, permlink: string, post: any) => {
    const key = `${author}/${permlink}`;
    dispatch({ type: 'HIVE_SET_POST', payload: { key, post } });
  }, []);

  const setHiveLoading = useCallback((type: keyof AppState['hive']['loading'], key: string, loading: boolean) => {
    dispatch({ type: 'HIVE_SET_LOADING', payload: { type, key, loading } });
  }, []);

  // Notification action creators
  const setNotifications = useCallback((notifications: any[]) => {
    dispatch({ type: 'NOTIFICATION_SET_DATA', payload: notifications });
  }, []);

  const markNotificationsRead = useCallback((ids: string | string[]) => {
    dispatch({ type: 'NOTIFICATION_MARK_READ', payload: ids });
  }, []);

  const setNotificationLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'NOTIFICATION_SET_LOADING', payload: loading });
  }, []);

  const setNotificationUnreadCount = useCallback((count: number) => {
    dispatch({ type: 'NOTIFICATION_UPDATE_UNREAD_COUNT', payload: count });
  }, []);

  // Auth action creators
  const setAuthToken = useCallback((token: string | null) => {
    dispatch({ type: 'AUTH_SET_TOKEN', payload: token });
  }, []);

  const setAuthRefreshToken = useCallback((refreshToken: string | null) => {
    dispatch({ type: 'AUTH_SET_REFRESH_TOKEN', payload: refreshToken });
  }, []);

  const setAuthTokens = useCallback((tokens: { token: string | null; refreshToken: string | null }) => {
    dispatch({ type: 'AUTH_SET_TOKENS', payload: tokens });
  }, []);

  const setAuthLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'AUTH_SET_LOADING', payload: loading });
  }, []);

  const setAuthError = useCallback((error: string | null) => {
    dispatch({ type: 'AUTH_SET_ERROR', payload: error });
  }, []);

  const clearAuth = useCallback(() => {
    dispatch({ type: 'AUTH_CLEAR' });
  }, []);

  // Memoized selectors
  const selectors = React.useMemo(() => ({
    // User selectors
    getCurrentUser: () => userSelectors.getCurrentUser(state.user),
    getHasActiveKey: () => userSelectors.getHasActiveKey(state.user),
    getUserProfile: (username: string) => userSelectors.getUserProfile(state.user, username),
    getFollowingList: (username: string) => userSelectors.getFollowingList(state.user, username),
    getMutedList: (username: string) => userSelectors.getMutedList(state.user, username),
    isFollowing: (follower: string, following: string) => userSelectors.isFollowing(state.user, follower, following),
    isMuted: (muter: string, muted: string) => userSelectors.isMuted(state.user, muter, muted),
    isUserLoading: (type: keyof AppState['user']['loading'], username: string) =>
      userSelectors.isLoading(state.user, type, username),
    needsUserRefresh: {
      profile: (username: string) => userSelectors.needsRefresh.profile(state.user, username),
      following: (username: string) => userSelectors.needsRefresh.following(state.user, username),
      muted: (username: string) => userSelectors.needsRefresh.muted(state.user, username),
    },

    // Hive selectors
    getHiveData: () => hiveSelectors.getHiveData(state.hive),
    needsHiveDataRefresh: () => hiveSelectors.needsHiveDataRefresh(state.hive),
    getPost: (author: string, permlink: string) => hiveSelectors.getPost(state.hive, author, permlink),
    needsPostRefresh: (author: string, permlink: string) => hiveSelectors.needsPostRefresh(state.hive, author, permlink),

    // Notification selectors
    getNotifications: () => notificationSelectors.getNotifications(state.notifications),
    getUnreadCount: () => notificationSelectors.getUnreadCount(state.notifications),
    needsNotificationRefresh: () => notificationSelectors.needsRefresh(state.notifications),

    // Auth selectors
    getAuthToken: () => authSelectors.getToken(state.auth),
    getAuthRefreshToken: () => authSelectors.getRefreshToken(state.auth),
    isAuthenticated: () => authSelectors.isAuthenticated(state.auth),
    isAuthLoading: () => authSelectors.isLoading(state.auth),
    getAuthError: () => authSelectors.getError(state.auth),
    isAuthenticationFresh: () => authSelectors.isAuthenticationFresh(state.auth),

    // Cross-slice selectors
    getCurrentUserFollowing: () => appSelectors.getCurrentUserFollowing(state),
    doesCurrentUserFollow: (username: string) => appSelectors.doesCurrentUserFollow(state, username),
    isAnyLoading: () => appSelectors.isAnyLoading(state),
    getCacheStats: () => appSelectors.getCacheStats(state),
  }), [state]);    // ...existing code...

  const contextValue: AppContextType = {
    state,
    dispatch,
    setCurrentUser,
    setUserProfile,
    setFollowingList,
    setFollowerList,
    setMutedList,
    setUserLoading,
    setUserError,
    setHasActiveKey,
    invalidateFollowingCache,
    invalidateMutedCache,
    clearUserCache,
    setHiveData,
    setHivePost,
    setHiveLoading,
    setNotifications,
    markNotificationsRead,
    setNotificationLoading,
    setNotificationUnreadCount,
    setAuthToken,
    setAuthRefreshToken,
    setAuthTokens,
    setAuthLoading,
    setAuthError,
    clearAuth,
    selectors,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the app context
export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}

// Convenience hooks for specific functionality
export function useCurrentUser() {
  const { selectors } = useAppStore();
  return selectors.getCurrentUser();
}

/**
 * Hook for authentication operations (login/logout)
 * Consolidates auth logic previously in useUserAuth
 */
export function useAuth() {
  const { setCurrentUser } = useAppStore();
  const currentUsername = useCurrentUser();

  const handleLogout = React.useCallback(async () => {
    try {
      // Clear legacy SecureStore data
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');

      // Clear session and JWT tokens
      SessionService.clearSession();
      authService.logout();

      // Clear current user from app state
      setCurrentUser(null);
    } catch (err) {
      throw new Error(
        'Logout failed: ' +
        (err instanceof Error ? err.message : JSON.stringify(err))
      );
    }
  }, [setCurrentUser]);

  return {
    currentUsername,
    handleLogout,
  };
}

export function useUserProfile(username: string) {
  const { selectors } = useAppStore();
  return selectors.getUserProfile(username);
}

export function useFollowingList(username: string) {
  const { selectors, setFollowingList, setUserLoading, setUserError } = useAppStore();

  // Memoize the setters so their reference never changes for a given username
  const stableSetFollowingList = React.useCallback((following: string[]) => setFollowingList(username, following), [setFollowingList, username]);
  const stableSetLoading = React.useCallback((loading: boolean) => setUserLoading('following', username, loading), [setUserLoading, username]);
  const stableSetError = React.useCallback((error: string | null) => setUserError('following', username, error), [setUserError, username]);

  const followingList = selectors.getFollowingList(username);
  const needsRefresh = selectors.needsUserRefresh.following(username);
  const isLoading = selectors.isUserLoading('following', username);

  return {
    followingList,
    needsRefresh,
    isLoading,
    setFollowingList: stableSetFollowingList,
    setLoading: stableSetLoading,
    setError: stableSetError,
  };
}

// Hook to access cache invalidation functions
export function useFollowCacheManagement() {
  const { invalidateFollowingCache, invalidateMutedCache } = useAppStore();

  return {
    invalidateFollowingCache,
    invalidateMutedCache,
  };
}

export function useMutedList(username: string) {
  const { selectors, setMutedList, setUserLoading, setUserError } = useAppStore();

  // Memoize the setters so their reference never changes for a given username
  const stableSetMutedList = React.useCallback((muted: string[]) => setMutedList(username, muted), [setMutedList, username]);
  const stableSetLoading = React.useCallback((loading: boolean) => setUserLoading('muted', username, loading), [setUserLoading, username]);
  const stableSetError = React.useCallback((error: string | null) => setUserError('muted', username, error), [setUserError, username]);

  const mutedList = selectors.getMutedList(username);
  const needsRefresh = selectors.needsUserRefresh.muted(username);
  const isLoading = selectors.isUserLoading('muted', username);

  return {
    mutedList,
    needsRefresh,
    isLoading,
    setMutedList: stableSetMutedList,
    setLoading: stableSetLoading,
    setError: stableSetError,
  };
}

export function useNotifications() {
  const { selectors, setNotifications, markNotificationsRead, setNotificationLoading, setNotificationUnreadCount } = useAppStore();

  return {
    notifications: selectors.getNotifications(),
    unreadCount: selectors.getUnreadCount(),
    needsRefresh: selectors.needsNotificationRefresh(),
    setNotifications,
    markNotificationsRead,
    setLoading: setNotificationLoading,
    setNotificationUnreadCount,
  };
}

// Debug hook
export function useAppDebug() {
  const { selectors } = useAppStore();

  return {
    cacheStats: selectors.getCacheStats(),
    isAnyLoading: selectors.isAnyLoading(),
    currentUser: selectors.getCurrentUser(),
    currentUserFollowing: selectors.getCurrentUserFollowing(),
  };
}
