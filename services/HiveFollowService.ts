import { PrivateKey } from '@hiveio/dhive';
import { getClient } from './HiveClient';
import { accountStorageService } from './AccountStorageService';

/**
 * What `follower` wants from `following`:
 * - ['blog']   follow
 * - ['ignore'] mute
 * - []         clear (unfollow / unmute)
 */
export type FollowWhat = [] | ['blog'] | ['ignore'];

/** Broadcast a `follow` custom_json signed with the stored posting key. */
export async function broadcastFollow(
  follower: string,
  following: string,
  what: FollowWhat
): Promise<void> {
  const postingKeyStr = await accountStorageService.getCurrentPostingKey();
  if (!postingKeyStr) {
    throw new Error('No posting key found. Please log in again.');
  }
  const postingKey = PrivateKey.fromString(postingKeyStr);

  await getClient().broadcast.json(
    {
      required_auths: [],
      required_posting_auths: [follower],
      id: 'follow',
      json: JSON.stringify(['follow', { follower, following, what }]),
    },
    postingKey
  );
}
