/**
 * Tests for utils/votes — the shared "did the current user upvote this?"
 * check used across every feed/detail surface. Covers both vote shapes that
 * exist in this codebase: condenser-style `percent` and bridge-style
 * `rshares`-only (bridge.get_ranked_posts returns no `percent` at all).
 */
import { activeVoteNet, deriveNetVotes, hasUserVoted } from '../votes';

describe('hasUserVoted', () => {
  it('returns true when the user appears with a positive percent (condenser shape)', () => {
    const votes = [
      { voter: 'alice', percent: 10000, rshares: 500 },
      { voter: 'bob', percent: -5000, rshares: -200 },
    ];
    expect(hasUserVoted(votes, 'alice')).toBe(true);
  });

  it('returns false for a downvote (negative percent)', () => {
    expect(hasUserVoted([{ voter: 'bob', percent: -5000, rshares: -200 }], 'bob')).toBe(false);
  });

  it('returns true for a bridge-shaped vote (rshares only, no percent)', () => {
    // bridge.get_ranked_posts returns { voter, rshares } — no percent key
    const votes = [{ voter: 'alice', rshares: 2389866260606 }];
    expect(hasUserVoted(votes, 'alice')).toBe(true);
  });

  it('returns false for a bridge-shaped downvote (negative rshares)', () => {
    expect(hasUserVoted([{ voter: 'alice', rshares: -100 }], 'alice')).toBe(false);
  });

  it('returns false when the user is not among the voters', () => {
    const votes = [{ voter: 'alice', percent: 10000 }];
    expect(hasUserVoted(votes, 'carol')).toBe(false);
  });

  it('returns false for a null/undefined username', () => {
    const votes = [{ voter: 'alice', percent: 10000 }];
    expect(hasUserVoted(votes, null)).toBe(false);
    expect(hasUserVoted(votes, undefined)).toBe(false);
  });

  it('returns false for a null/undefined/non-array vote list', () => {
    expect(hasUserVoted(null, 'alice')).toBe(false);
    expect(hasUserVoted(undefined, 'alice')).toBe(false);
    expect(hasUserVoted('not-an-array' as any, 'alice')).toBe(false);
  });

  it('does not count a 0-percent entry as a vote', () => {
    expect(hasUserVoted([{ voter: 'alice', percent: 0, rshares: 0 }], 'alice')).toBe(false);
  });
});

describe('activeVoteNet', () => {
  it('maps percent up/down/neutral to +1/-1/0', () => {
    expect(activeVoteNet({ voter: 'a', percent: 100 })).toBe(1);
    expect(activeVoteNet({ voter: 'a', percent: -100 })).toBe(-1);
    expect(activeVoteNet({ voter: 'a', percent: 0 })).toBe(0);
  });

  it('falls back to rshares when percent is absent (bridge shape)', () => {
    expect(activeVoteNet({ voter: 'a', rshares: 1 })).toBe(1);
    expect(activeVoteNet({ voter: 'a', rshares: -1 })).toBe(-1);
    expect(activeVoteNet({ voter: 'a' })).toBe(0);
    expect(activeVoteNet(null)).toBe(0);
  });

  it('prefers percent over rshares when both are present', () => {
    // Optimistic entries carry percent with rshares: 0 — percent must win
    expect(activeVoteNet({ voter: 'a', percent: 100, rshares: 0 })).toBe(1);
  });
});

describe('deriveNetVotes', () => {
  it('computes upvotes − downvotes across mixed shapes', () => {
    const votes = [
      { voter: 'a', rshares: 10 },        // bridge up
      { voter: 'b', rshares: -5 },        // bridge down
      { voter: 'c', percent: 10000 },     // condenser up
      { voter: 'd', percent: -10000 },    // condenser down
    ];
    expect(deriveNetVotes(votes)).toBe(0);
  });

  it('returns 0 for an empty or missing list', () => {
    expect(deriveNetVotes([])).toBe(0);
    expect(deriveNetVotes(null)).toBe(0);
    expect(deriveNetVotes(undefined)).toBe(0);
  });

  it('matches the live bridge payload shape (rshares-only voters)', () => {
    const votes = [
      { voter: 'jza', rshares: 5856255498 },
      { voter: 'meno', rshares: 2389866260606 },
      { voter: 'troll', rshares: -100 },
    ];
    expect(deriveNetVotes(votes)).toBe(1); // 2 up − 1 down
  });
});