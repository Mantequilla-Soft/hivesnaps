/**
 * Paging helpers for a profile's followers / following lists.
 *
 * condenser_api.get_followers / get_following return accounts in
 * alphabetical order, starting after `start`. Some nodes include the start
 * account itself as the first entry, so it is dropped if it comes back.
 */

export type FollowListKind = 'followers' | 'following';

/** Raw RPC call, e.g. `(api, method, params) => getClient().call(api, method, params)`. */
export type HiveRpcCall = (api: string, method: string, params: unknown) => Promise<unknown>;

interface FollowEntry {
  follower?: string;
  following?: string;
  what?: string[];
}

export interface FollowPage {
  /** Account names on this page, in API order. */
  names: string[];
  /** Pass as `start` to fetch the next page. */
  nextStart: string;
  /** True when there is nothing after this page. */
  done: boolean;
}

export const FOLLOW_PAGE_SIZE = 100;

export async function fetchFollowPage(
  call: HiveRpcCall,
  account: string,
  kind: FollowListKind,
  start = '',
  limit = FOLLOW_PAGE_SIZE
): Promise<FollowPage> {
  const method = kind === 'followers' ? 'get_followers' : 'get_following';
  const res = await call('condenser_api', method, [account, start, 'blog', limit]);
  const entries: FollowEntry[] = Array.isArray(res) ? res : [];
  const field = kind === 'followers' ? 'follower' : 'following';

  const names = entries
    .map((e) => e[field])
    .filter((n): n is string => typeof n === 'string' && n.length > 0 && n !== start);

  return {
    names,
    nextStart: entries.length ? (entries[entries.length - 1][field] ?? start) : start,
    done: entries.length < limit,
  };
}

/** Safety stop when reading a whole list: 20 pages of 1,000. */
const MAX_FULL_PAGES = 20;

export interface FollowingSet {
  following: Set<string>;
  /**
   * False if the safety stop was hit before the end of the list. Then an
   * account missing from `following` is unknown, not necessarily unfollowed.
   */
  complete: boolean;
}

/**
 * Every account `account` follows (blog follows), read 1,000 at a time.
 * Used to show Follow / Unfollow on each row of a follow list.
 */
export async function fetchAllFollowing(
  call: HiveRpcCall,
  account: string,
  maxPages: number = MAX_FULL_PAGES
): Promise<FollowingSet> {
  const following = new Set<string>();
  let start = '';
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchFollowPage(call, account, 'following', start, 1000);
    page.names.forEach((n) => following.add(n));
    if (page.done || page.nextStart === start) return { following, complete: true };
    start = page.nextStart;
  }
  return { following, complete: false };
}
