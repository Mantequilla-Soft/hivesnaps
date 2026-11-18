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
