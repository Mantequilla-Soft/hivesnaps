import { useState, useCallback, useEffect } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateVoteValue } from '../utils/calculateVoteValue';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { SessionService } from '../services/SessionService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export interface VoteValue {
  hbd: string;
  usd: string;
}

export interface UpvoteTarget {
  author: string;
  permlink: string;
  snap?: any; // Full snap data for optimistic updates
}

interface UseUpvoteReturn {
  // State
  upvoteModalVisible: boolean;
  upvoteTarget: UpvoteTarget | null;
  voteWeight: number;
  voteValue: VoteValue | null;
  upvoteLoading: boolean;
  upvoteSuccess: boolean;
  voteWeightLoading: boolean;

  // Actions
  openUpvoteModal: (target: UpvoteTarget) => Promise<void>;
  closeUpvoteModal: () => void;
  setVoteWeight: (weight: number) => void;
  confirmUpvote: () => Promise<void>;
  updateSnapsOptimistically: (
    snaps: any[],
    target: UpvoteTarget,
    voteWeight: number,
    voteValue: VoteValue | null
  ) => any[];
}

export const useUpvote = (
  username: string | null,
  globalProps: any,
  rewardFund: any,
  hivePrice: number,
  updateSnap?: (author: string, permlink: string, updates: any) => void,
  updateReply?: (author: string, permlink: string, updates: any) => void
): UseUpvoteReturn => {
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<UpvoteTarget | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteValue, setVoteValue] = useState<VoteValue | null>(null);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  const [voteWeightLoading, setVoteWeightLoading] = useState(false);
  const [storedAccountObj, setStoredAccountObj] = useState<any | null>(null);

  // Recalculate vote value whenever vote weight changes and modal is open
  useEffect(() => {
    const recalculateVoteValue = async () => {
      if (!upvoteModalVisible || !username || voteWeightLoading || !storedAccountObj) {
        return;
      }

      try {
        if (storedAccountObj && globalProps && rewardFund) {
          const calcValue = calculateVoteValue(
            storedAccountObj,
            globalProps,
            rewardFund,
            voteWeight,
            hivePrice
          );
          setVoteValue(calcValue);
        } else {
          setVoteValue(null);
        }
      } catch (err) {
        console.error('[useUpvote] Error recalculating vote value:', err);
        setVoteValue(null);
      }
    };

    recalculateVoteValue();
  }, [voteWeight, upvoteModalVisible, username, globalProps, rewardFund, hivePrice, voteWeightLoading, storedAccountObj]);

  const openUpvoteModal = useCallback(
    async (target: UpvoteTarget) => {
      setUpvoteTarget(target);
      setVoteWeightLoading(true);

      try {
        // Get stored vote weight
        const val = await AsyncStorage.getItem('hivesnaps_vote_weight');
        const weight = val !== null ? Number(val) : 100;
        setVoteWeight(weight);

        // Fetch account object for vote value calculation
        let accountObj = null;
        if (username) {
          const accounts = await client.database.getAccounts([username]);
          accountObj = accounts && accounts[0] ? accounts[0] : null;
          setStoredAccountObj(accountObj); // Store for later use
        }

        // Calculate initial vote value
        if (accountObj && globalProps && rewardFund) {
          console.log('[VoteValueDebug] accountObj:', accountObj);
          console.log('[VoteValueDebug] globalProps:', globalProps);
          console.log('[VoteValueDebug] rewardFund:', rewardFund);
          console.log('[VoteValueDebug] hivePrice:', hivePrice);
          const calcValue = calculateVoteValue(
            accountObj,
            globalProps,
            rewardFund,
            weight,
            hivePrice
          );
          console.log('[VoteValueDebug] calculateVoteValue result:', calcValue);
          setVoteValue(calcValue);
        } else {
          setVoteValue(null);
        }
      } catch (err) {
        setVoteWeight(100);
        // Try to calculate vote value with default weight
        let accountObj = null;
        if (username) {
          const accounts = await client.database.getAccounts([username]);
          accountObj = accounts && accounts[0] ? accounts[0] : null;
          setStoredAccountObj(accountObj); // Store for later use
        }
        if (accountObj && globalProps && rewardFund) {
          const calcValue = calculateVoteValue(
            accountObj,
            globalProps,
            rewardFund,
            100,
            hivePrice
          );
          setVoteValue(calcValue);
        } else {
          setVoteValue(null);
        }
      }

      setVoteWeightLoading(false);
      setUpvoteModalVisible(true);
    },
    [username, globalProps, rewardFund, hivePrice]
  );

  const closeUpvoteModal = useCallback(() => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteValue(null);
    setStoredAccountObj(null); // Clear stored account data
    // Do not reset voteWeight, keep last used value
  }, []);

  const confirmUpvote = useCallback(async () => {
    if (!upvoteTarget || !username) return;

    setUpvoteLoading(true);
    setUpvoteSuccess(false);

    try {
      // Retrieve posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr)
        throw new Error('Session expired. Please unlock your account again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Ecency-style weight: 1-100% slider maps to -10000 to 10000 (positive for upvote)
      let weight = Math.round(voteWeight * 100);
      if (weight > 10000) weight = 10000;
      if (weight < 1) weight = 1;

      // Use dhive to broadcast vote
      await client.broadcast.vote(
        {
          voter: username,
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          weight,
        },
        postingKey
      );

      // Persist the vote weight after successful vote
      await AsyncStorage.setItem('hivesnaps_vote_weight', String(voteWeight));

      setUpvoteLoading(false);
      setUpvoteSuccess(true);

      // Update the snap/reply optimistically if update functions are provided
      if (upvoteTarget && upvoteTarget.snap) {
        console.log('[useUpvote] Updating optimistically:', {
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          snapData: upvoteTarget.snap,
        });

        // Recalculate vote value using current voteWeight (in case voteValue is stale/null)
        let calculatedVoteValue = voteValue;
        if (!calculatedVoteValue && username) {
          try {
            const accounts = await client.database.getAccounts([username]);
            const accountObj = accounts && accounts[0] ? accounts[0] : null;
            if (accountObj && globalProps && rewardFund) {
              calculatedVoteValue = calculateVoteValue(
                accountObj,
                globalProps,
                rewardFund,
                voteWeight,
                hivePrice
              );
            }
          } catch (err) {
            console.error('[useUpvote] Error recalculating vote value:', err);
          }
        }

        const estimatedValueIncrease = calculatedVoteValue
          ? parseFloat(calculatedVoteValue.usd)
          : 0;
        const upvoteUpdates = createUpvoteUpdate(voteWeight, username || '');
        const currentVotes =
          upvoteTarget.snap.voteCount || upvoteTarget.snap.net_votes || 0;
        const currentPayout =
          upvoteTarget.snap.payout ||
          parseFloat(
            upvoteTarget.snap.pending_payout_value?.replace(' HBD', '') || '0'
          );

        const updateData = {
          ...upvoteUpdates,
          voteCount: currentVotes + 1,
          net_votes: currentVotes + 1,
          payout: currentPayout + estimatedValueIncrease,
          pending_payout_value: `${(currentPayout + estimatedValueIncrease).toFixed(3)} HBD`,
        };

        console.log('[useUpvote] Update data:', updateData);

        // Determine if this is a reply or main snap
        // Check for parent_author field (but exclude 'peak.snaps' which is a container)
        // or permlink pattern that starts with "re-"
        const isReply =
          (upvoteTarget.snap.parent_author &&
            upvoteTarget.snap.parent_author !== '' &&
            upvoteTarget.snap.parent_author !== 'peak.snaps') ||
          upvoteTarget.permlink.startsWith('re-');
        console.log(
          '[useUpvote] Is reply:',
          isReply,
          'permlink:',
          upvoteTarget.permlink,
          'parent_author:',
          upvoteTarget.snap.parent_author
        );

        if (isReply && updateReply) {
          console.log('[useUpvote] Using updateReply for reply');
          updateReply(upvoteTarget.author, upvoteTarget.permlink, updateData);
        } else if (updateSnap) {
          console.log('[useUpvote] Using updateSnap for main snap');
          updateSnap(upvoteTarget.author, upvoteTarget.permlink, updateData);
        }
      }

      // Close modal after showing success
      setTimeout(() => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        setVoteValue(null);
        setStoredAccountObj(null); // Clear stored account data
      }, 1500);
    } catch (err) {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert('Upvote failed: ' + errorMsg);
    }
  }, [upvoteTarget, username, voteWeight]);

  const { updateSnapInArray, createUpvoteUpdate } = useOptimisticUpdates();

  const updateSnapsOptimistically = useCallback(
    (
      snaps: any[],
      target: UpvoteTarget,
      weight: number,
      value: VoteValue | null
    ) => {
      const estimatedValueIncrease = value ? parseFloat(value.usd) : 0;
      const upvoteUpdates = createUpvoteUpdate(weight, username || '');
      const targetSnap = snaps.find(
        s => s.author === target.author && s.permlink === target.permlink
      );

      return updateSnapInArray(snaps, target.author, target.permlink, {
        ...upvoteUpdates,
        voteCount: (targetSnap?.voteCount || 0) + 1,
        payout: (targetSnap?.payout || 0) + estimatedValueIncrease,
      });
    },
    [username, updateSnapInArray, createUpvoteUpdate]
  );

  return {
    // State
    upvoteModalVisible,
    upvoteTarget,
    voteWeight,
    voteValue,
    upvoteLoading,
    upvoteSuccess,
    voteWeightLoading,

    // Actions
    openUpvoteModal,
    closeUpvoteModal,
    setVoteWeight,
    confirmUpvote,
    updateSnapsOptimistically,
  };
};
