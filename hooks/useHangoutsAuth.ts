import { useState, useCallback, useRef } from 'react';
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
  // Ref-based guard so the closure always sees the latest in-flight state
  const isLoadingRef = useRef(false);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (isLoadingRef.current) return false;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const success = await hangoutsAuthService.authenticate();
      setIsAuthenticated(success);
      return success;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    authenticate,
    client: hangoutsAuthService.getClient(),
  };
}
