import { fetchAllFollowing, fetchFollowPage, type HiveRpcCall } from '../followList';

/** Fake node holding an alphabetical follower list; `inclusive` repeats the start entry. */
function fakeNode(all: string[], inclusive = false): { call: HiveRpcCall; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const call: HiveRpcCall = async (_api, method, params) => {
    const [account, start, , limit] = params as [string, string, string, number];
    calls.push([method, start, limit]);
    const from = start ? all.findIndex((n) => (inclusive ? n >= start : n > start)) : 0;
    const slice = from < 0 ? [] : all.slice(from, from + limit);
    return slice.map((n) =>
      method === 'get_followers'
        ? { follower: n, following: account, what: ['blog'] }
        : { follower: account, following: n, what: ['blog'] }
    );
  };
  return { call, calls };
}

async function readAll(call: HiveRpcCall, kind: 'followers' | 'following', limit: number): Promise<string[]> {
  const out: string[] = [];
  let start = '';
  for (let i = 0; i < 50; i++) {
    const page = await fetchFollowPage(call, 'alice', kind, start, limit);
    out.push(...page.names);
    if (page.done) break;
    start = page.nextStart;
  }
  return out;
}

const names = Array.from({ length: 25 }, (_, i) => `user${String(i).padStart(2, '0')}`);

describe('fetchFollowPage', () => {
  it('reads followers with the follower field and get_followers', async () => {
    const { call, calls } = fakeNode(names);
    const page = await fetchFollowPage(call, 'alice', 'followers', '', 10);
    expect(page.names).toEqual(names.slice(0, 10));
    expect(page.nextStart).toBe('user09');
    expect(page.done).toBe(false);
    expect(calls[0]).toEqual(['get_followers', '', 10]);
  });

  it('reads following with the following field and get_following', async () => {
    const { call, calls } = fakeNode(names);
    const page = await fetchFollowPage(call, 'alice', 'following', '', 10);
    expect(page.names[0]).toBe('user00');
    expect(calls[0][0]).toBe('get_following');
  });

  it('pages through everything without duplicates (exclusive start)', async () => {
    const { call } = fakeNode(names);
    expect(await readAll(call, 'followers', 10)).toEqual(names);
  });

  it('pages through everything without duplicates (inclusive start)', async () => {
    const { call } = fakeNode(names, true);
    expect(await readAll(call, 'followers', 10)).toEqual(names);
  });

  it('marks a short page as done and handles an empty list', async () => {
    const { call } = fakeNode([]);
    const page = await fetchFollowPage(call, 'alice', 'followers');
    expect(page).toEqual({ names: [], nextStart: '', done: true });
  });
});

describe('fetchAllFollowing', () => {
  it('reads every page of 1,000 into a set', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => `acct${String(i).padStart(4, '0')}`);
    const { call, calls } = fakeNode(many, true);
    const { following, complete } = await fetchAllFollowing(call, 'alice');
    expect(following.size).toBe(2500);
    expect(following.has('acct2499')).toBe(true);
    expect(complete).toBe(true);
    expect(calls.every((c) => c[0] === 'get_following' && c[2] === 1000)).toBe(true);
  });

  it('returns an empty set for an account that follows nobody', async () => {
    const { call } = fakeNode([]);
    expect(await fetchAllFollowing(call, 'alice')).toEqual({ following: new Set(), complete: true });
  });

  it('marks the set incomplete when it stops at the page limit', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => `acct${String(i).padStart(4, '0')}`);
    const { call } = fakeNode(many);
    const { following, complete } = await fetchAllFollowing(call, 'alice', 2);
    expect(following.size).toBe(2000);
    expect(complete).toBe(false);
  });
});
