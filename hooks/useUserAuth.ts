import { useState, useEffect } from 'react';
import { useAppStore } from '../store/context';
import { accountStorageService } from '../services/AccountStorageService';

/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use `useAuth()` from '../store/context' for logout functionality
 * Use `useCurrentUser()` from '../store/context' to get the current username
 * 
 * Migration example:
 * ```ts
 * // Old:
 * const { currentUsername, handleLogout } = useUserAuth();
 * 
 * // New:
 * import { useAuth, useCurrentUser } from '../store/context';
 * const { handleLogout } = useAuth(); // if you need logout
 * const currentUsername = useCurrentUser(); // if you only need username
 * ```
 */
export const useUserAuth = () => {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const { setCurrentUser } = useAppStore();

  // Load current user credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await accountStorageService.getCurrentAccountUsername();
        setCurrentUsername(storedUsername);
        setCurrentUser(storedUsername); // Sync with context
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, [setCurrentUser]);

  // Keep context in sync if username changes (manual set)
  useEffect(() => {
    setCurrentUser(currentUsername);
  }, [currentUsername, setCurrentUser]);

  const handleLogout = async () => {
    try {
      await accountStorageService.clearCurrentAccountUsername();
      setCurrentUsername(null);
      setCurrentUser(null); // Sync with context
    } catch (err) {
      throw new Error(
        'Logout failed: ' +
          (err instanceof Error ? err.message : JSON.stringify(err))
      );
    }
  };

  return {
    currentUsername,
    setCurrentUsername,
    handleLogout,
  };
};
