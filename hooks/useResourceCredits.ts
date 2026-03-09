import { useState, useEffect, useCallback } from 'react';
import { getClient } from '../services/HiveClient';

interface ResourceCreditsData {
  account: string;
  rc_manabar: {
    current_mana: string;
    last_update_time: number;
  };
  max_rc_creation_adjustment: {
    amount: string;
    precision: number;
    nai: string;
  };
  max_rc: string;
}

export const useResourceCredits = (username: string | null) => {
  const [resourceCredits, setResourceCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRCPercentage = useCallback((rcData: ResourceCreditsData) => {
    try {
      const currentMana = parseFloat(rcData.rc_manabar.current_mana);
      const maxRc = parseFloat(rcData.max_rc);

      if (maxRc === 0) return 0;

      // Calculate percentage (0-100)
      const percentage = (currentMana / maxRc) * 100;
      return Math.max(0, Math.min(100, percentage));
    } catch (err) {
      console.error('Error calculating RC percentage:', err);
      return 0;
    }
  }, []);

  const fetchResourceCredits = useCallback(async () => {
    if (!username) {
      setResourceCredits(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getClient();

      const response = await client.call('rc_api', 'find_rc_accounts', {
        accounts: [username],
      });

      if (response?.rc_accounts && response.rc_accounts.length > 0) {
        const rcData = response.rc_accounts[0];
        const rcPercentage = calculateRCPercentage(rcData);
        setResourceCredits(rcPercentage);
      } else {
        setResourceCredits(0);
      }
    } catch (err) {
      console.error('Error fetching resource credits:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch resource credits'
      );
      setResourceCredits(null);
    } finally {
      setLoading(false);
    }
  }, [username, calculateRCPercentage]);

  const updateResourceCreditsOptimistically = useCallback((newRc: number) => {
    setResourceCredits(prev => {
      if (prev === null) return newRc;
      return Math.max(0, Math.min(100, newRc));
    });
  }, []);

  const refreshResourceCredits = useCallback(() => {
    return fetchResourceCredits();
  }, [fetchResourceCredits]);

  useEffect(() => {
    fetchResourceCredits();
  }, [fetchResourceCredits]);

  return {
    resourceCredits,
    loading,
    error,
    refreshResourceCredits,
    updateResourceCreditsOptimistically,
  };
};
