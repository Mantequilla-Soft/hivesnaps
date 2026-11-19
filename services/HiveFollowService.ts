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

/**
 * Broadcast a custom_json under the `follow` id, signed with the stored
 * posting key. Follow, mute and reblog all share this id; the chain tells
 * them apart by the action name in the payload.
 */
async function broadcastFollowOp(account: string, payload: [string, Record<string, unknown>]): Promise<void> {
  const postingKeyStr = await accountStorageService.getCurrentPostingKey();
  if (!postingKeyStr) {
    throw new Error('No posting key found. Please log in again.');
  }
  const postingKey = PrivateKey.fromString(postingKeyStr);

  await getClient().broadcast.json(
    {
      required_auths: [],
      required_posting_auths: [account],
      id: 'follow',
      json: JSON.stringify(payload),
    },
    postingKey
  );
}

/** Broadcast a `follow` custom_json signed with the stored posting key. */
export async function broadcastFollow(
  follower: string,
  following: string,
  what: FollowWhat
): Promise<void> {
  await broadcastFollowOp(follower, ['follow', { follower, following, what }]);
}

/**
 * Reblog a top-level post to `account`'s blog. The chain rejects reblogging
 * your own post, a reply, or the same post twice, so callers should guard
 * those cases first.
 */
export async function broadcastReblog(account: string, author: string, permlink: string): Promise<void> {
  await broadcastFollowOp(account, ['reblog', { account, author, permlink }]);
}

/**
 * Accounts that have reblogged a post (from any app). A failed lookup
 * returns [] so callers treat it as "not reblogged" rather than blocking.
 */
export async function fetchRebloggedBy(author: string, permlink: string): Promise<string[]> {
  try {
    const res = await getClient().database.call('get_reblogged_by', [author, permlink]);
    return Array.isArray(res) ? res.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return [];
  }
}
