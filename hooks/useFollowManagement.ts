import { useState, useEffect } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import { useFollowCacheManagement } from '../store/context';
import { SessionService } from '../services/SessionService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useFollowManagement = (
  currentUsername: string | null,
  targetUsername: string | undefined
) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);

  // Cache management for immediate updates
  const { invalidateFollowingCache, invalidateMutedCache } = useFollowCacheManagement();

  // Check if current user is following/muting the profile user
  const checkFollowStatus = async () => {
    if (
      !currentUsername ||
      !targetUsername ||
      currentUsername === targetUsername
    )
      return;

    try {
      console.log(
        `🔍 Checking follow status: ${currentUsername} -> ${targetUsername}`
      );

      // Check following status - get all users that currentUsername follows
      // Parameters: [follower, startFollowing, followType, limit]
      const following = await client.call('condenser_api', 'get_following', [
        currentUsername,
        '',
        'blog',
        1000,
      ]);
      console.log(
        `📊 Following API returned ${following?.length || 0} results`
      );

      // Check if the target username is in the list of people we follow
      const isCurrentlyFollowing =
        Array.isArray(following) &&
        following.some((f: any) => {
          const matches =
            f.following === targetUsername && f.what?.includes('blog');
          if (matches) {
            console.log(
              `✅ Found follow relationship: ${f.following} with what: ${f.what}`
            );
          }
          return matches;
        });

      console.log(
        `🎯 Follow status result: ${isCurrentlyFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`
      );
      setIsFollowing(isCurrentlyFollowing);

      // Check mute status - get all users that currentUsername ignores
      const ignoring = await client.call('condenser_api', 'get_following', [
        currentUsername,
        '',
        'ignore',
        1000,
      ]);
      console.log(`🔇 Ignoring API returned ${ignoring?.length || 0} results`);

      const isCurrentlyMuting =
        Array.isArray(ignoring) &&
        ignoring.some((f: any) => {
          const matches =
            f.following === targetUsername && f.what?.includes('ignore');
          if (matches) {
            console.log(
              `🔇 Found mute relationship: ${f.following} with what: ${f.what}`
            );
          }
          return matches;
        });

      console.log(
        `🔇 Mute status result: ${isCurrentlyMuting ? 'MUTED' : 'NOT MUTED'}`
      );
      setIsMuted(isCurrentlyMuting);
    } catch (error) {
      console.log('Error checking follow/mute status:', error);
      // Reset to default states on error
      setIsFollowing(false);
      setIsMuted(false);
    }
  };

  useEffect(() => {
    if (
      currentUsername &&
      targetUsername &&
      currentUsername !== targetUsername
    ) {
      checkFollowStatus();
    }
  }, [currentUsername, targetUsername]);

  const handleFollow = async () => {
    if (!currentUsername || !targetUsername || followLoading) return;

    setFollowLoading(true);
    try {
      // Get posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create follow operation
      const followOp = [
        'follow',
        {
          follower: currentUsername,
          following: targetUsername,
          what: ['blog'], // Follow their blog posts
        },
      ];

      // Broadcast the follow operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(followOp),
        },
        postingKey
      );

      setIsFollowing(true);

      // Invalidate follow cache to trigger immediate refresh
      if (currentUsername) {
        invalidateFollowingCache(currentUsername);
        console.log('🔄 Invalidated following cache for:', currentUsername);
      }

      console.log('Successfully followed:', targetUsername);
    } catch (error) {
      console.log('Error following user:', error);
      throw error;
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUsername || !targetUsername || followLoading) return;

    setFollowLoading(true);
    try {
      // Get posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create unfollow operation
      const unfollowOp = [
        'follow',
        {
          follower: currentUsername,
          following: targetUsername,
          what: [], // Empty array means unfollow
        },
      ];

      // Broadcast the unfollow operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(unfollowOp),
        },
        postingKey
      );

      setIsFollowing(false);

      // Invalidate follow cache to trigger immediate refresh
      if (currentUsername) {
        invalidateFollowingCache(currentUsername);
        console.log('🔄 Invalidated following cache for:', currentUsername);
      }

      console.log('Successfully unfollowed:', targetUsername);
    } catch (error) {
      console.log('Error unfollowing user:', error);
      throw error;
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMute = async () => {
    if (!currentUsername || !targetUsername || muteLoading) return;

    setMuteLoading(true);
    try {
      // Get posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create mute operation
      const muteOp = [
        'follow',
        {
          follower: currentUsername,
          following: targetUsername,
          what: ['ignore'], // Mute/ignore user
        },
      ];

      // Broadcast the mute operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(muteOp),
        },
        postingKey
      );

      setIsMuted(true);

      // Invalidate muted cache to trigger immediate refresh
      if (currentUsername) {
        invalidateMutedCache(currentUsername);
        console.log('🔇 Invalidated muted cache for:', currentUsername);
      }

      console.log('Successfully muted:', targetUsername);
    } catch (error) {
      console.log('Error muting user:', error);
      throw error;
    } finally {
      setMuteLoading(false);
    }
  };

  const handleUnmute = async () => {
    if (!currentUsername || !targetUsername || muteLoading) return;

    setMuteLoading(true);
    try {
      // Get posting key from session
      const postingKeyStr = SessionService.getCurrentPostingKey();
      if (!postingKeyStr) {
        throw new Error('Session expired. Please unlock your account again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create unmute operation (same as unfollow - empty array)
      const unmuteOp = [
        'follow',
        {
          follower: currentUsername,
          following: targetUsername,
          what: [], // Empty array removes all follow relationships including mute
        },
      ];

      // Broadcast the unmute operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(unmuteOp),
        },
        postingKey
      );

      setIsMuted(false);

      // Invalidate muted cache to trigger immediate refresh
      if (currentUsername) {
        invalidateMutedCache(currentUsername);
        console.log('🔇 Invalidated muted cache for:', currentUsername);
      }

      console.log('Successfully unmuted:', targetUsername);
    } catch (error) {
      console.log('Error unmuting user:', error);
      throw error;
    } finally {
      setMuteLoading(false);
    }
  };

  return {
    isFollowing,
    isMuted,
    followLoading,
    muteLoading,
    handleFollow,
    handleUnfollow,
    handleMute,
    handleUnmute,
    checkFollowStatus,
  };
};
