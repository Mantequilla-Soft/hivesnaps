/**
 * Authentication Hook - Provides easy access to auth functionality
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/context';
import { authService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';

export const useAuth = () => {
  const router = useRouter();
  const {
    setAuthTokens,
    setAuthLoading,
    setAuthError,
    clearAuth,
    selectors,
    setCurrentUser,
    setHasActiveKey,
  } = useAppStore();

  const {
    getAuthToken,
    getAuthRefreshToken,
    isAuthenticated,
    isAuthLoading,
    getAuthError,
    isAuthenticationFresh,
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
    // Clear tokens from auth service
    authService.logout();

    // Clear tokens from context
    clearAuth();

    // Clear session
    SessionService.clearSession();

    // Clear current user from app state
    setCurrentUser(null);
    setHasActiveKey(false);

    // Navigate to account selection (or login if no accounts)
    router.replace('/screens/AccountSelectionScreen' as any);
  }, [clearAuth, setCurrentUser, setHasActiveKey, router]);

  /**
   * Switch to a different account
   */
  const switchAccount = useCallback(() => {
    // Clear current session
    SessionService.clearSession();

    // Clear auth tokens
    clearAuth();
    authService.logout();

    // Clear current user from app state
    setCurrentUser(null);
    setHasActiveKey(false);

    // Navigate to account selection
    router.push('/screens/AccountSelectionScreen' as any);
  }, [clearAuth, setCurrentUser, setHasActiveKey, router]);

  /**
   * Get current account username
   */
  const getCurrentAccount = useCallback((): string | null => {
    return SessionService.getCurrentUsername();
  }, []);

  /**
   * Check if current account has active key
   */
  const hasActiveKey = useCallback((): boolean => {
    return SessionService.hasActiveKey();
  }, []);

  /**
   * Check if session is still valid
   */
  const isSessionValid = useCallback((): boolean => {
    return SessionService.isSessionValid();
  }, []);

  /**
   * Prompt user to add active key if not available
   */
  const requireActiveKey = useCallback((): boolean => {
    const username = SessionService.getCurrentUsername();
    if (!username || SessionService.hasActiveKey()) {
      return true; // Has active key or no user
    }

    // Navigate to add active key screen
    router.push({
      pathname: '/screens/AddActiveKeyScreen' as any,
      params: { username },
    });

    return false;
  }, [router]);

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
    currentAccount: getCurrentAccount(),
    hasActiveKey: hasActiveKey(),
    isSessionValid: isSessionValid(),

    // Actions
    authenticate,
    logout,
    switchAccount,
    requireActiveKey,
    clearError: () => setAuthError(null),

    // Utilities
    getCurrentToken,
  };
};
