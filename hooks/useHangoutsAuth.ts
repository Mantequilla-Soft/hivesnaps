import { useState, useCallback } from 'react';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

export function useHangoutsAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(hangoutsAuthService.isAuthenticated());
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = useCallback(async () => {
    setIsLoading(true);
    try {
      const success = await hangoutsAuthService.authenticate();
      setIsAuthenticated(success);
      return success;
    } finally {
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
