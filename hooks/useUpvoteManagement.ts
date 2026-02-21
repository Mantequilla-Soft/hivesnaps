import { useState, useEffect } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateVoteValue } from '../utils/calculateVoteValue';
import { SessionService } from '../services/SessionService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useUpvoteManagement = (
  currentUsername: string | null,
  globalProps: any,
  rewardFund: any,
  hivePrice: number
) => {
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{
    author: string;
    permlink: string;
  } | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteWeightLoading, setVoteWeightLoading] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  const [voteValue, setVoteValue] = useState<{
    hbd: string;
    usd: string;
  } | null>(null);

  // Initialize reward fund and hive price
  useEffect(() => {
    const initializeUpvoteData = async () => {
      try {
        // Fetch reward fund
        const fund = await client.database.call('get_reward_fund', ['post']);

        // Fetch hive price
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd'
        );
        const data = await response.json();
        const price = data.hive?.usd || 1;
      } catch (error) {
        console.log('Error initializing upvote data:', error);
      }
    };
    initializeUpvoteData();
  }, []);

  // Handle upvote for Snap component integration (opens modal)
  const handleSnapUpvoteFromComponent = async (target: {
    author: string;
    permlink: string;
  }) => {
    setUpvoteTarget(target);
    setVoteWeightLoading(true);

    try {
      // Load last used vote weight if available
      const val = await AsyncStorage.getItem('hivesnaps_vote_weight');
      const weight = val !== null ? Number(val) : 100;
      setVoteWeight(weight);

      // Calculate vote value if possible
      let accountObj = null;
      if (currentUsername) {
        const accounts = await client.database.getAccounts([currentUsername]);
        accountObj = accounts && accounts[0] ? accounts[0] : null;
      }

      if (accountObj && globalProps && rewardFund) {
        const calcValue = calculateVoteValue(
          accountObj,
          globalProps,
          rewardFund,
          weight,
          hivePrice
        );
        setVoteValue(calcValue);
      } else {
        setVoteValue(null);
      }
    } catch (error) {
      console.log('Error setting up upvote modal:', error);
      setVoteWeight(100);
      setVoteValue(null);
    } finally {
      setVoteWeightLoading(false);
      setUpvoteModalVisible(true);
    }
  };

  // Close upvote modal
  const closeUpvoteModal = () => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteValue(null);
    setUpvoteSuccess(false);
  };

  // Confirm upvote
  const confirmUpvote = async () => {
    if (!upvoteTarget || !currentUsername) return;

    setUpvoteLoading(true);
    setUpvoteSuccess(false);

    try {
      // Haptic feedback for user interaction
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Get posting key from secure storage
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Convert weight (1-100% slider maps to 1-10000 dhive weight)
      let weight = Math.round(voteWeight * 100);
      if (weight > 10000) weight = 10000;
      if (weight < 1) weight = 1;

      // Broadcast vote
      await client.broadcast.vote(
        {
          voter: currentUsername,
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          weight,
        },
        postingKey
      );

      // Persist the vote weight after successful vote
      await AsyncStorage.setItem('hivesnaps_vote_weight', String(voteWeight));

      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setUpvoteLoading(false);
      setUpvoteSuccess(true);

      console.log('Successfully upvoted snap:', upvoteTarget.permlink);

      // Close modal after showing success
      setTimeout(() => {
        closeUpvoteModal();
      }, 1500);
    } catch (error) {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
      // Error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Error upvoting snap:', error);
      throw error;
    }
  };

  // Update vote weight and recalculate value
  const updateVoteWeight = async (newWeight: number) => {
    setVoteWeight(newWeight);

    // Recalculate vote value with new weight
    if (currentUsername && globalProps && rewardFund) {
      try {
        const accounts = await client.database.getAccounts([currentUsername]);
        const accountObj = accounts && accounts[0] ? accounts[0] : null;

        if (accountObj) {
          const calcValue = calculateVoteValue(
            accountObj,
            globalProps,
            rewardFund,
            newWeight,
            hivePrice
          );
          setVoteValue(calcValue);
        }
      } catch (error) {
        console.log('Error updating vote value:', error);
      }
    }
  };

  return {
    upvoteModalVisible,
    upvoteTarget,
    voteWeight,
    voteWeightLoading,
    upvoteLoading,
    upvoteSuccess,
    voteValue,
    handleSnapUpvoteFromComponent,
    closeUpvoteModal,
    confirmUpvote,
    updateVoteWeight,
  };
};
