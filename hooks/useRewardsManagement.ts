import { useState } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import { SessionService } from '../services/SessionService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useRewardsManagement = (
  currentUsername: string | null,
  profile: any,
  isOwnProfile: boolean,
  onRefresh?: () => Promise<void>
) => {
  const [claimLoading, setClaimLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleClaimRewards = async () => {
    if (!profile || !currentUsername || !isOwnProfile) return;

    const { unclaimedHive = 0, unclaimedHbd = 0, unclaimedVests = 0 } = profile;

    // Check if there are any rewards to claim
    if (unclaimedHive === 0 && unclaimedHbd === 0 && unclaimedVests === 0) {
      return;
    }

    setClaimLoading(true);

    try {
      // Get posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Format reward balances for the claim operation
      const rewardHiveBalance = `${unclaimedHive.toFixed(3)} HIVE`;
      const rewardHbdBalance = `${unclaimedHbd.toFixed(3)} HBD`;
      const rewardVestingBalance = `${unclaimedVests.toFixed(6)} VESTS`;

      console.log('Claiming rewards:', {
        rewardHiveBalance,
        rewardHbdBalance,
        rewardVestingBalance,
      });

      // Broadcast the claim_reward_balance operation
      await client.broadcast.sendOperations(
        [
          [
            'claim_reward_balance',
            {
              account: currentUsername,
              reward_hive: rewardHiveBalance,
              reward_hbd: rewardHbdBalance,
              reward_vests: rewardVestingBalance,
            },
          ],
        ],
        postingKey
      );

      console.log('Rewards claimed successfully!');

      // Set processing state to true
      setProcessing(true);

      // Add delay to account for Hive blockchain block time (3 seconds)
      setTimeout(() => {
        // Poll for updated profile data every second for up to 4 retries
        let retryCount = 0;
        const maxRetries = 4;

        const pollForProfileUpdate = async () => {
          console.log(
            `Profile polling attempt ${retryCount + 1}/${maxRetries}`
          );

          try {
            // Fetch updated account data
            const accounts = await client.database.call('get_accounts', [
              [currentUsername],
            ]);
            if (accounts && accounts[0]) {
              const account = accounts[0];

              // Check if unclaimed rewards have been reset
              const newUnclaimedHive = parseFloat(
                (account.reward_hive_balance || '0.000 HIVE').replace(
                  ' HIVE',
                  ''
                )
              );
              const newUnclaimedHbd = parseFloat(
                (account.reward_hbd_balance || '0.000 HBD').replace(' HBD', '')
              );
              const newUnclaimedVests = parseFloat(
                (account.reward_vesting_balance || '0.000000 VESTS').replace(
                  ' VESTS',
                  ''
                )
              );

              console.log('Checking unclaimed rewards after claim:', {
                newUnclaimedHive,
                newUnclaimedHbd,
                newUnclaimedVests,
                originalUnclaimedHive: unclaimedHive,
                originalUnclaimedHbd: unclaimedHbd,
                originalUnclaimedVests: unclaimedVests,
              });

              // If rewards have been reset (claimed), refresh the profile
              if (
                newUnclaimedHive === 0 &&
                newUnclaimedHbd === 0 &&
                newUnclaimedVests === 0
              ) {
                console.log('Rewards successfully claimed, refreshing profile');
                await onRefresh?.();
                setProcessing(false);
                return;
              }
            }
          } catch (error) {
            console.error('Error polling for profile update:', error);
          }

          retryCount++;
          if (retryCount < maxRetries) {
            console.log(
              'Profile not updated yet, polling again in 1 second...'
            );
            setTimeout(pollForProfileUpdate, 1000); // Poll again in 1 second
          } else {
            console.log('Max retries reached, stopping profile polling');
            setProcessing(false);
          }
        };

        pollForProfileUpdate(); // Start polling
      }, 3000);
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    } finally {
      setClaimLoading(false);
    }
  };

  return {
    claimLoading,
    processing,
    handleClaimRewards,
  };
};
