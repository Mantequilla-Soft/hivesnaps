/**
 * Authentication Hook - Provides easy access to auth functionality
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/context';
import { authService } from '../services/AuthService';
import { accountStorageService } from '../services/AccountStorageService';

export const useAuth = () => {
  const router = useRouter();
  const {
    setAuthTokens,
    setAuthLoading,
    setAuthError,
    clearAuth,
    setCurrentUser,
    setHasActiveKey,
    selectors
  } = useAppStore();

  const {
    getAuthToken,
    getAuthRefreshToken,
    isAuthenticated,
    isAuthLoading,
    getAuthError,
    isAuthenticationFresh,
    getCurrentUser,
    getHasActiveKey,
  } = selectors;

  /**
   * Authenticate user and get JWT token
   */
  const authenticate = useCallback(async (username: string, postingKey: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const result = await authService.authenticate(username, postingKey);
      
      if (result.success && result.token) {
        // Store both JWT token and refresh token
        const refreshToken = authService.getRefreshToken();
        setAuthTokens({ 
          token: result.token, 
          refreshToken: refreshToken 
        });
        setAuthLoading(false);
        return true;
      } else {
        setAuthError(result.error || 'Authentication failed');
        setAuthLoading(false);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      setAuthError(errorMessage);
      setAuthLoading(false);
      return false;
    }
  }, [setAuthTokens, setAuthLoading, setAuthError]);

  /**
   * Logout user and clear all auth data
   */
  const logout = useCallback(async () => {
    try {
      await accountStorageService.clearCurrentAccountUsername();
    } catch (error) {
      console.error('[useAuth] Failed to clear current account:', error);
      throw error;
    }
    authService.logout();
    clearAuth();
    setCurrentUser(null);
    setHasActiveKey(false);
  }, [clearAuth, setCurrentUser, setHasActiveKey]);

  /**
   * Switch to a different stored account
   * Loads keys, re-authenticates JWT, updates store
   */
  const switchAccount = useCallback(async (username: string): Promise<void> => {
    const keys = await accountStorageService.getAccountKeys(username);
    if (!keys) {
      throw new Error(`No keys found for account @${username}`);
    }
    await accountStorageService.setCurrentAccountUsername(username);
    setCurrentUser(username);
    setHasActiveKey(!!keys.activeKey);
    // Best-effort JWT — don't block the switch if it fails
    try {
      await authenticate(username, keys.postingKey);
    } catch {
      console.warn('[useAuth] JWT re-auth failed after account switch');
      setAuthError('Switched account but could not refresh authentication. Some features may be unavailable.');
    }
  }, [setCurrentUser, setHasActiveKey, authenticate, setAuthError]);

  /**
   * Navigate to AddActiveKeyScreen for the current user if they don't have
   * an active key. Returns true if the key is already present (caller may
   * proceed), false if navigation was triggered (caller should abort).
   */
  const requireActiveKey = useCallback((): boolean => {
    const username = getCurrentUser();
    if (!username) {
      return false; // No user logged in — caller should not proceed
    }
    if (getHasActiveKey()) {
      return true; // Already has active key — caller may proceed
    }
    // Navigate to the add-active-key screen.
    // expo-router's typed push doesn't know this path yet — cast to never
    // until route types are regenerated.
    router.push({
      pathname: '/screens/AddActiveKeyScreen' as never,
      params: { username },
    });
    return false;
  }, [router, getCurrentUser, getHasActiveKey]);

  /**
   * Get current JWT token for API calls
   */
  const getCurrentToken = useCallback((): string | null => {
    return authService.getToken() || getAuthToken();
  }, [getAuthToken]);

  /**
   * Check if user needs to authenticate
   */
  const needsAuthentication = useCallback((): boolean => {
    return !isAuthenticated() || !getCurrentToken();
  }, [isAuthenticated, getCurrentToken]);

  return {
    // State
    isAuthenticated: isAuthenticated(),
    isLoading: isAuthLoading(),
    error: getAuthError(),
    token: getCurrentToken(),
    needsAuthentication: needsAuthentication(),
    isAuthenticationFresh: isAuthenticationFresh(),
    currentUsername: getCurrentUser(),
    hasActiveKey: getHasActiveKey(),

    // Actions
    authenticate,
    logout,
    switchAccount,
    requireActiveKey,
    setHasActiveKey,
    clearError: () => setAuthError(null),

    // Utilities
    getCurrentToken,
  };
};
