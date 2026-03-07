import { useState, useEffect, useCallback } from 'react';
import { calculateVotingPower } from '../utils/calculateVotingPower';
import { useCurrentUser } from '../store/context';
import { getHiveClient, hiveCallWithFailover } from '../services/HiveClient';

export const useVotingPower = () => {
  const username = useCurrentUser(); // Get current user from global state
  const [votingPower, setVotingPower] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVotingPower = useCallback(async () => {
    // Only fetch if we have a logged-in user
    if (!username) {
      setVotingPower(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [account] = await hiveCallWithFailover(client => client.database.getAccounts([username]));
      if (!account) {
        console.log('Account not found:', username);
        setLoading(false);
        return;
      }

      // Use the accurate voting power calculation with regeneration
      let vp = calculateVotingPower(account);
      // Defensive: sanitize non-finite values (e.g., division by zero cases)
      if (!Number.isFinite(vp)) vp = 0;
      setVotingPower(vp);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching voting power:', error);
      setLoading(false);
    }
  }, [username]);

  // Fetch voting power on mount and when username changes
  useEffect(() => {
    fetchVotingPower();
  }, [fetchVotingPower]);

  // Update voting power optimistically after upvoting
  const updateVotingPowerOptimistically = useCallback(
    (decreaseBy: number = 200) => {
      if (votingPower !== null) {
        const newVp = Math.max(0, votingPower - decreaseBy);
        setVotingPower(newVp);
      }
    },
    [votingPower]
  );

  // Refresh voting power (useful after upvoting)
  const refreshVotingPower = useCallback(() => {
    fetchVotingPower();
  }, [fetchVotingPower]);

  return {
    votingPower,
    loading,
    error,
    fetchVotingPower,
    updateVotingPowerOptimistically,
    refreshVotingPower,
  };
};
