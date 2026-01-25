import { useState, useEffect } from 'react';
import { Client } from '@hiveio/dhive';
import { avatarService } from '../services/AvatarService';
import { useUserProfile } from '../store/context';
import { vestsToHp } from '../utils/hiveCalculations';

// Profile data interface
export interface ProfileData {
  username: string;
  avatarUrl?: string;
  reputation: number;
  hivePower: number;
  hbd: number;
  displayName?: string;
  about?: string;
  location?: string;
  website?: string;
  followingCount?: number;
  followersCount?: number;
  // Unclaimed rewards
  unclaimedHive?: number;
  unclaimedHbd?: number;
  unclaimedVests?: number;
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useProfileData = (username: string | undefined) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalProps, setGlobalProps] = useState<any>(null);
  // Get global user profile (immediate updates, e.g. avatar)
  let globalProfile: any = undefined;
  try {
    globalProfile = useUserProfile(username || '');
  } catch (err) {
    console.error('[useProfileData] useUserProfile threw error:', err);
    console.trace('[useProfileData] useUserProfile call stack');
  }

  useEffect(() => {
    // Always prefer globalProfile.profile_image for avatarUrl, with cache-busting if available
    if (globalProfile && globalProfile.profile_image) {
      const cacheBustedUrl = `${globalProfile.profile_image}?t=${globalProfile.profile_image_last_updated || Date.now()}`;
      setProfile(prev => (prev ? { ...prev, avatarUrl: cacheBustedUrl } : prev));
    }
  }, [globalProfile?.profile_image, globalProfile?.profile_image_last_updated]);

  const fetchProfileData = async () => {
    if (!username) return;

    setLoading(true);
    try {
      // Try multiple methods to get account data
      console.log('Fetching account data for:', username);

      // Method 1: dhive get_accounts
      const accounts = await client.database.call('get_accounts', [[username]]);
      if (!accounts || !accounts[0]) {
        throw new Error('Account not found');
      }

      const account = accounts[0];

      // Method 2: Fetch reputation using syncad.com API (much more reliable!)
      let reputation = 25; // fallback
      try {
        console.log(
          'Fetching reputation from syncad.com API for:',
          username
        );
        const reputationResponse = await fetch(
          `https://api.syncad.com/reputation-api/accounts/${username}/reputation`
        );
        if (reputationResponse.ok) {
          const reputationText = await reputationResponse.text();
          const reputationNumber = parseInt(reputationText.trim(), 10);
          if (!isNaN(reputationNumber)) {
            reputation = reputationNumber;
            console.log(
              'Successfully fetched reputation from API:',
              reputation
            );
          } else {
            console.log(
              'Invalid reputation response from API:',
              reputationText
            );
          }
        } else {
          console.log(
            'Failed to fetch reputation from API, status:',
            reputationResponse.status
          );
        }
      } catch (reputationError) {
        console.log('Error fetching reputation from API:', reputationError);
      }

      // 🔍 DEBUG: Log the raw account data
      console.log(`\n=== PROFILE DEBUG for @${username} ===`);
      console.log('Raw account object keys:', Object.keys(account));
      console.log('FULL ACCOUNT OBJECT:', JSON.stringify(account, null, 2));
      console.log('Raw reputation:', account.reputation);
      console.log('Raw reputation type:', typeof account.reputation);

      // Try alternative reputation field names
      console.log('account.rep:', account.rep);
      console.log('account.reputation_score:', account.reputation_score);
      console.log('account.user_reputation:', account.user_reputation);

      console.log('Raw balance:', account.balance);
      console.log('Raw HBD balance:', account.hbd_balance);
      console.log('Raw vesting_shares:', account.vesting_shares);
      console.log(
        'Raw delegated_vesting_shares:',
        account.delegated_vesting_shares
      );
      console.log(
        'Raw received_vesting_shares:',
        account.received_vesting_shares
      );
      console.log('Following count:', account.following_count);
      console.log('Follower count:', account.follower_count);

      // Debug metadata fields
      console.log('Raw posting_json_metadata:', account.posting_json_metadata);
      console.log('Raw json_metadata:', account.json_metadata);

      // Fetch global dynamic properties for HP calculation
      const fetchedGlobalProps =
        await client.database.getDynamicGlobalProperties();
      setGlobalProps(fetchedGlobalProps);
      console.log(
        'Global props total_vesting_fund_hive:',
        fetchedGlobalProps.total_vesting_fund_hive
      );
      console.log(
        'Global props total_vesting_shares:',
        fetchedGlobalProps.total_vesting_shares
      );
      console.log(
        'Global props type check - total_vesting_fund_hive:',
        typeof fetchedGlobalProps.total_vesting_fund_hive
      );
      console.log(
        'Global props type check - total_vesting_shares:',
        typeof fetchedGlobalProps.total_vesting_shares
      );

      // Parse profile metadata - more robust parsing
      let profileMeta: any = {};
      try {
        // Try posting_json_metadata first (most up-to-date)
        if (account.posting_json_metadata) {
          try {
            const postingMeta = JSON.parse(account.posting_json_metadata);
            if (postingMeta.profile) {
              profileMeta = { ...profileMeta, ...postingMeta.profile };
            }
          } catch (e) {
            console.log('Error parsing posting_json_metadata:', e);
          }
        }

        // If no profile data found in posting_json_metadata, try json_metadata
        if (
          account.json_metadata &&
          !profileMeta.name &&
          !profileMeta.profile_image
        ) {
          try {
            const jsonMeta = JSON.parse(account.json_metadata);
            if (jsonMeta.profile) {
              profileMeta = { ...profileMeta, ...jsonMeta.profile };
            }
          } catch (e) {
            console.log('Error parsing json_metadata:', e);
          }
        }

        console.log('Parsed profile metadata:', profileMeta);
      } catch (e) {
        console.log('Error parsing profile metadata:', e);
      }

      // Parse balances
      const hiveBalance = parseFloat(account.balance.replace(' HIVE', ''));
      const hbdBalance = parseFloat(account.hbd_balance.replace(' HBD', ''));

      console.log('Parsed HIVE balance:', hiveBalance);
      console.log('Parsed HBD balance:', hbdBalance);

      // More accurate Hive Power calculation
      const vestingShares = parseFloat(
        account.vesting_shares.replace(' VESTS', '')
      );
      const delegatedVests = parseFloat(
        account.delegated_vesting_shares.replace(' VESTS', '')
      );
      const receivedVests = parseFloat(
        account.received_vesting_shares.replace(' VESTS', '')
      );
      const effectiveVests = vestingShares - delegatedVests + receivedVests;

      console.log('Parsed vesting_shares:', vestingShares);
      console.log('Parsed delegated_vesting_shares:', delegatedVests);
      console.log('Parsed received_vesting_shares:', receivedVests);
      console.log('Calculated effective_vests:', effectiveVests);

      // Calculate Hive Power using Ecency's exact vestsToHp method
      const hivePower = vestsToHp(
        effectiveVests,
        fetchedGlobalProps.total_vesting_fund_hive,
        fetchedGlobalProps.total_vesting_shares
      );

      console.log('Calculated Hive Power using Ecency method:', hivePower);

      // Parse unclaimed rewards
      const unclaimedHive = parseFloat(
        (account.reward_hive_balance || '0.000 HIVE').replace(' HIVE', '')
      );
      const unclaimedHbd = parseFloat(
        (account.reward_hbd_balance || '0.000 HBD').replace(' HBD', '')
      );
      const unclaimedVests = parseFloat(
        (account.reward_vesting_balance || '0.000000 VESTS').replace(
          ' VESTS',
          ''
        )
      );

      console.log('Unclaimed HIVE:', unclaimedHive);
      console.log('Unclaimed HBD:', unclaimedHbd);
      console.log('Unclaimed VESTS:', unclaimedVests);

      // Set profile with account object counts first (non-blocking)
      // Avatar: use unified AvatarService (Ecency images service) for immediate first paint
      const imagesUrl = `https://images.ecency.com/u/${account.name}/avatar/original`;
      const cachedAvatar = avatarService.getCachedAvatarUrl(account.name) || imagesUrl;
      const profileData = {
        username: account.name,
        // Only use Ecency/cachedAvatar if no globalProfile.profile_image
        avatarUrl: globalProfile && globalProfile.profile_image
          ? `${globalProfile.profile_image}?t=${globalProfile.profile_image_last_updated || Date.now()}`
          : cachedAvatar,
        reputation: reputation, // Direct from API - no need for rounding!
        hivePower: Math.round(hivePower * 100) / 100,
        hbd: Math.round(hbdBalance * 100) / 100,
        displayName: profileMeta.name,
        about: profileMeta.about,
        location: profileMeta.location,
        website: profileMeta.website,
        followingCount: account.following_count || 0,
        followersCount: account.follower_count || 0,
        unclaimedHive,
        unclaimedHbd,
        unclaimedVests,
      };

      console.log('Setting profile data:', profileData);
      setProfile(profileData);

      // Background: resolve avatar via service and update if changed
      avatarService
        .getAvatarUrl(account.name)
        .then(({ url, source }) => {
          if (url && url !== cachedAvatar) {
            console.log(`[Avatar][Profile] ${account.name} -> ${url} (source=${source})`);
            setProfile(prev => (prev ? { ...prev, avatarUrl: url } : prev));
          }
        })
        .catch(() => { });

      // Fetch accurate follow counts using the proper API
      try {
        const followCount = await client.database.call('get_follow_count', [
          username,
        ]);
        console.log('Follow count API result:', followCount);

        // Update profile with accurate follow counts
        setProfile(prev => ({
          ...prev!,
          followingCount: followCount.following_count || 0,
          followersCount: followCount.follower_count || 0,
        }));

        console.log('Updated follow counts:', {
          following: followCount.following_count || 0,
          followers: followCount.follower_count || 0,
        });

        console.log('Final profile data being set (post-follow counts):', {
          username: account.name,
          displayName: profileMeta.name,
          avatarUrl: cachedAvatar,
          about: profileMeta.about,
          location: profileMeta.location,
          website: profileMeta.website,
        });
      } catch (e) {
        console.log('Error fetching follow counts:', e);
        // Keep the counts from account object as fallback
      }

      console.log('Follow counts from account object:', {
        following: account.following_count || 0,
        followers: account.follower_count || 0,
      });

      console.log('=== FINAL CALCULATED VALUES ===');
      console.log('Final reputation:', reputation);
      console.log('Final Hive Power:', Math.round(hivePower * 100) / 100);
      console.log('Final HBD:', Math.round(hbdBalance * 100) / 100);
      console.log('===============================\n');
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) {
      fetchProfileData();
    }
  }, [username]);

  return {
    profile,
    loading,
    globalProps,
    refetch: fetchProfileData,
  };
};
