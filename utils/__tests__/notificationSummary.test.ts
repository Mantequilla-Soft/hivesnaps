import {
    computeActivitySummary,
    matchesSummaryFilter,
    needsOlderPages,
    rangeStart,
    summaryTiles,
} from '../notificationSummary';

// Hive dates are UTC without a trailing Z.
const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 86_400_000).toISOString().replace('Z', '').slice(0, 19);
const n = (type: string, ago: number, msg = '', actionUser?: string) => ({ type, date: daysAgo(ago), msg, actionUser });

describe('rangeStart', () => {
    it('is local midnight for today, 7 days back for the week, one month back for the month', () => {
        const today = new Date(rangeStart('today', NOW));
        expect([today.getHours(), today.getMinutes(), today.getSeconds()]).toEqual([0, 0, 0]);
        expect(rangeStart('week', NOW)).toBe(NOW.getTime() - 7 * 86_400_000);
        const month = new Date(NOW);
        month.setMonth(month.getMonth() - 1);
        expect(rangeStart('month', NOW)).toBe(month.getTime());
    });
});

describe('computeActivitySummary', () => {
    const list = [
        n('vote', 1, '@alice voted on your post ($0.013)', 'alice'),
        n('vote', 2, '@alice voted on your post ($0.020)', 'alice'),
        n('vote', 3, '@bob voted on your post ($0.5)'), // actor read from the message
        n('reply', 1),
        n('reply_comment', 2),
        n('follow', 4),
        n('mention', 5),
        n('reblog', 6),
        n('transfer', 6),
        n('vote', 20, '@carol voted on your post ($9.000)', 'carol'), // outside the week
    ];

    it('counts each kind inside the range, with distinct voters and vote value', () => {
        expect(computeActivitySummary(list, 'week', NOW)).toEqual({
            total: 9,
            votes: 3,
            uniqueVoters: 2,
            earnings: 0.533,
            replies: 2,
            follows: 1,
            mentions: 1,
            reblogs: 1,
            transfers: 1,
        });
    });

    it('widens with the range', () => {
        const month = computeActivitySummary(list, 'month', NOW);
        expect(month.votes).toBe(4);
        expect(month.uniqueVoters).toBe(3);
        expect(month.earnings).toBe(9.533);
    });

    it('is all zeros when nothing falls in the range', () => {
        expect(computeActivitySummary([n('vote', 40, '($1)')], 'month', NOW).total).toBe(0);
    });
});

describe('summaryTiles', () => {
    it('shows only the kinds that happened, in order, with singular labels for one', () => {
        const tiles = summaryTiles({
            total: 4, votes: 1, uniqueVoters: 1, earnings: 0.42, replies: 0, follows: 2, mentions: 0, reblogs: 1, transfers: 0,
        });
        expect(tiles.map((t) => [t.filter, t.value, t.label])).toEqual([
            ['votes', 1, 'Vote'],
            ['follows', 2, 'New followers'],
            ['reblogs', 1, 'Reblog'],
        ]);
        expect(tiles[0]).toEqual(expect.objectContaining({ detail: '1 voter', sub: '$0.42' }));
    });

    it('leaves out the vote value when there is none', () => {
        const [votes] = summaryTiles({
            total: 2, votes: 2, uniqueVoters: 2, earnings: 0, replies: 0, follows: 0, mentions: 0, reblogs: 0, transfers: 0,
        });
        expect(votes.sub).toBeUndefined();
        expect(votes.detail).toBe('2 voters');
    });
});

it('matches replies and comment replies to the Replies filter', () => {
    expect(matchesSummaryFilter({ type: 'reply' }, 'replies')).toBe(true);
    expect(matchesSummaryFilter({ type: 'reply_comment' }, 'replies')).toBe(true);
    expect(matchesSummaryFilter({ type: 'vote' }, 'replies')).toBe(false);
});

describe('needsOlderPages', () => {
    it('is true while the oldest loaded notification is still inside the range', () => {
        expect(needsOlderPages([{ date: daysAgo(1) }, { date: daysAgo(3) }], 'week', NOW)).toBe(true);
        expect(needsOlderPages([{ date: daysAgo(1) }, { date: daysAgo(9) }], 'week', NOW)).toBe(false);
        expect(needsOlderPages([], 'week', NOW)).toBe(false);
    });
});
