import { useState, useEffect, useCallback } from 'react';
import { hiveCallWithFailover } from '../services/HiveClient';
import { avatarService } from '../services/AvatarService';
import { useUserProfile as useUserProfileGlobal } from '../store/context';

export const useUserProfile = (username: string | null) => {
  // Prefer global state for avatar if available
  const globalProfile = useUserProfileGlobal(username || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasUnclaimedRewards, setHasUnclaimedRewards] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let didCancel = false;
    async function fetchProfile() {
      if (!username) {
        setAvatarUrl(null);
        setHasUnclaimedRewards(false);
        setLoading(false);
        return;
      }
      // 1. Prefer global profile image
      if (globalProfile && globalProfile.profile_image) {
        setAvatarUrl(
          `${globalProfile.profile_image}?t=${globalProfile.profile_image_last_updated || Date.now()}`
        );
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const accounts = await hiveCallWithFailover(client => client.database.getAccounts([username]));
        if (didCancel) return;
        if (accounts && accounts.length > 0) {
          const account = accounts[0];
          // Try avatarService, fallback to Ecency CDN
          let url = avatarService.getCachedAvatarUrl(account.name);
          if (!url) {
            url = `https://images.ecency.com/u/${account.name}/avatar/original`;
          }
          setAvatarUrl(url);
          avatarService
            .getAvatarUrl(account.name)
            .then(({ url: fetchedUrl }) => {
              if (!didCancel) setAvatarUrl(fetchedUrl || `https://images.ecency.com/u/${account.name}/avatar/original`);
            })
            .catch(() => {
              if (!didCancel) setAvatarUrl(`https://images.ecency.com/u/${account.name}/avatar/original`);
            });
          // Check for unclaimed rewards
          const unclaimedHbd = parseFloat(String(account.reward_hbd_balance || '0'));
          const unclaimedHive = parseFloat(String(account.reward_vesting_balance || '0'));
          const unclaimedVests = parseFloat(String(account.reward_vesting_hive || '0'));
          const hasRewards = unclaimedHbd > 0 || unclaimedHive > 0 || unclaimedVests > 0;
          setHasUnclaimedRewards(hasRewards);
        } else {
          setAvatarUrl(`https://images.ecency.com/u/${username}/avatar/original`);
          setHasUnclaimedRewards(false);
          setError('Account not found');
        }
      } catch (err) {
        if (!didCancel) {
          setError('Failed to fetch user profile');
          setAvatarUrl(`https://images.ecency.com/u/${username}/avatar/original`);
          setHasUnclaimedRewards(false);
        }
      } finally {
        if (!didCancel) setLoading(false);
      }
    }
    fetchProfile();
    return () => {
      didCancel = true;
    };
  }, [globalProfile, username]);

  // Refresh profile data
  const refreshProfile = useCallback(() => {
    if (!username) return;
    setLoading(true);
    hiveCallWithFailover(client => client.database.getAccounts([username])).then(
      (accounts) => {
        if (accounts && accounts.length > 0) {
          const account = accounts[0];
          let url = avatarService.getCachedAvatarUrl(account.name);
          if (!url) {
            url = `https://images.ecency.com/u/${account.name}/avatar/original`;
          }
          setAvatarUrl(url);
          avatarService
            .getAvatarUrl(account.name)
            .then(({ url: fetchedUrl }) => {
              setAvatarUrl(fetchedUrl || `https://images.ecency.com/u/${account.name}/avatar/original`);
            })
            .catch(() => {
              setAvatarUrl(`https://images.ecency.com/u/${account.name}/avatar/original`);
            });
          // Check for unclaimed rewards
          const unclaimedHbd = parseFloat(String(account.reward_hbd_balance || '0'));
          const unclaimedHive = parseFloat(String(account.reward_vesting_balance || '0'));
          const unclaimedVests = parseFloat(String(account.reward_vesting_hive || '0'));
          const hasRewards = unclaimedHbd > 0 || unclaimedHive > 0 || unclaimedVests > 0;
          setHasUnclaimedRewards(hasRewards);
        } else {
          setAvatarUrl(`https://images.ecency.com/u/${username}/avatar/original`);
          setHasUnclaimedRewards(false);
          setError('Account not found');
        }
        setLoading(false);
      },
      (err) => {
        setError('Failed to fetch user profile');
        setAvatarUrl(`https://images.ecency.com/u/${username}/avatar/original`);
        setHasUnclaimedRewards(false);
        setLoading(false);
      }
    );
  }, [username]);

  return {
    avatarUrl,
    hasUnclaimedRewards,
    loading,
    error,
    fetchUserProfile: refreshProfile,
    refreshProfile,
  };
};
