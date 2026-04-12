import { useState, useCallback } from 'react';
import type { HangoutsApiClient } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

interface UseHangoutsAuthResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  authenticate: () => Promise<boolean>;
  client: HangoutsApiClient;
}

export function useHangoutsAuth(): UseHangoutsAuthResult {
  const [isAuthenticated, setIsAuthenticated] = useState(hangoutsAuthService.isAuthenticated());
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (isLoading) return false;
    setIsLoading(true);
    try {
      const success = await hangoutsAuthService.authenticate();
      setIsAuthenticated(success);
      return success;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return {
    isAuthenticated,
    isLoading,
    authenticate,
    client: hangoutsAuthService.getClient(),
  };
}
