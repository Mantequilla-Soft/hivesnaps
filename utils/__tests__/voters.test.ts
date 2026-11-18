import { buildVoterRows, fetchAllVotes, formatReputation, getPostPayout, type HiveRpcCall } from '../voters';

describe('getPostPayout', () => {
  it('uses pending payout while the post is open', () => {
    expect(getPostPayout({ pending_payout_value: '1.500 HBD', total_payout_value: '0.000 HBD' })).toBe(1.5);
  });

  it('sums author and curator payout once paid out', () => {
    expect(
      getPostPayout({
        pending_payout_value: '0.000 HBD',
        total_payout_value: '0.750 HBD',
        curator_payout_value: '0.250 HBD',
      })
    ).toBe(1);
  });

  it('returns 0 for missing fields', () => {
    expect(getPostPayout({})).toBe(0);
  });
});

describe('formatReputation', () => {
  it('rounds raw reputation to the display score', () => {
    expect(formatReputation(0)).toBe(25);
    expect(formatReputation(95832978796820)).toBe(70);
    expect(formatReputation('95832978796820')).toBe(70);
  });

  it('handles negative reputation', () => {
    expect(formatReputation(-95832978796820)).toBe(-20);
  });

  it('returns null when missing', () => {
    expect(formatReputation(undefined)).toBeNull();
  });
});

describe('buildVoterRows', () => {
  const post = { pending_payout_value: '10.000 HBD' };

  it('splits payout by rshares share and sorts by value', () => {
    const rows = buildVoterRows(
      [
        { voter: 'small', percent: 10000, rshares: 1000 },
        { voter: 'big', percent: 5000, rshares: 3000 },
      ],
      post
    );
    expect(rows.map((r) => r.voter)).toEqual(['big', 'small']);
    expect(rows[0].value).toBeCloseTo(7.5);
    expect(rows[1].value).toBeCloseTo(2.5);
    expect(rows[0].percent).toBe(50);
  });

  it('gives downvotes a negative value and flags them', () => {
    const rows = buildVoterRows(
      [
        { voter: 'up', percent: 10000, rshares: 4000 },
        { voter: 'down', percent: -10000, rshares: -2000 },
      ],
      post
    );
    const down = rows.find((r) => r.voter === 'down')!;
    expect(down.isDownvote).toBe(true);
    expect(down.value).toBeCloseTo(-10);
    expect(rows[rows.length - 1].voter).toBe('down');
  });

  it('handles bridge-shaped votes with no percent and string rshares', () => {
    const rows = buildVoterRows([{ voter: 'a', rshares: '500' }], post);
    expect(rows[0].percent).toBeNull();
    expect(rows[0].value).toBeCloseTo(10);
    expect(rows[0].isDownvote).toBe(false);
  });

  it('returns zero values when net rshares is not positive', () => {
    const rows = buildVoterRows([{ voter: 'a', percent: 10000, rshares: 0 }], post);
    expect(rows[0].value).toBe(0);
  });

  it('drops revoked votes (percent 0) but keeps zero-rshares votes', () => {
    const rows = buildVoterRows(
      [
        { voter: 'revoked', percent: 0, rshares: 0 },
        { voter: 'revokedString', percent: '0', rshares: '0' },
        { voter: 'noPower', percent: 10000, rshares: 0 },
        { voter: 'bridgeShape', rshares: 0 },
        { voter: 'real', percent: 5000, rshares: 1000 },
      ],
      post
    );
    expect(rows.map((r) => r.voter).sort()).toEqual(['bridgeShape', 'noPower', 'real']);
  });
});

describe('fetchAllVotes', () => {
  const author = 'alice';
  const permlink = 'post';
  const voterName = (i: number) => `v${String(i).padStart(5, '0')}`;
  const allVoters = Array.from({ length: 1131 }, (_, i) => voterName(i));

  /** Fake node: get_content capped at 1000, list_votes paged by voter name and
   *  running on into another comment's votes once this post's run out. */
  interface ListVotesParams {
    start: [string, string, string];
    limit: number;
  }

  function fakeNode(voterNames: string[]) {
    const calls: string[] = [];
    const call: HiveRpcCall = async (api, method, rawParams) => {
      calls.push(method);
      if (method === 'get_content') {
        return {
          pending_payout_value: '11.310 HBD',
          active_votes: voterNames.slice(0, 1000).map(v => ({ voter: v, rshares: 100, percent: 10000, reputation: 0 })),
        };
      }
      const params = rawParams as ListVotesParams;
      const startVoter = params.start[2];
      const mine = voterNames
        .filter(v => v >= startVoter)
        .map(v => ({ voter: v, author, permlink, rshares: 100, vote_percent: 10000 }));
      const other = Array.from({ length: 1000 }, (_, i) => ({ voter: voterName(i), author: 'bob', permlink: 'other', rshares: 5, vote_percent: 100 }));
      return { votes: [...mine, ...other].slice(0, params.limit) };
    };
    return { call, calls };
  }

  it('makes one call when the post has fewer than 1000 votes', async () => {
    const { call, calls } = fakeNode(allVoters.slice(0, 40));
    const { votes } = await fetchAllVotes(call, author, permlink);
    expect(votes).toHaveLength(40);
    expect(calls).toEqual(['get_content']);
  });

  it('pages past the 1000-vote cap without duplicates or other posts\' votes', async () => {
    const { call, calls } = fakeNode(allVoters);
    const { post, votes } = await fetchAllVotes(call, author, permlink);
    expect(votes).toHaveLength(1131);
    expect(new Set(votes.map(v => v.voter)).size).toBe(1131);
    expect(calls).toEqual(['get_content', 'list_votes', 'list_votes']);

    // Voters from get_content keep their reputation; paged-in ones have none.
    const rows = buildVoterRows(votes, post);
    expect(rows.find(r => r.voter === voterName(0))!.reputation).toBe(25);
    expect(rows.find(r => r.voter === voterName(1130))!.reputation).toBeNull();
    // Payout is split over all 1131 equal votes, not just the first 1000.
    expect(rows[0].value).toBeCloseTo(0.01);
  });

  it('stops when a full page belongs to another post', async () => {
    const { call, calls } = fakeNode(allVoters.slice(0, 1000));
    const { votes } = await fetchAllVotes(call, author, permlink);
    expect(votes).toHaveLength(1000);
    expect(calls.filter(c => c === 'list_votes')).toHaveLength(2);
  });
});
