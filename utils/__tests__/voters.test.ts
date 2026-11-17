import { buildVoterRows, formatReputation, getPostPayout } from '../voters';

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
    const rows = buildVoterRows([{ voter: 'a', percent: 0, rshares: 0 }], post);
    expect(rows[0].value).toBe(0);
  });
});
