jest.mock('../../services/ModerationService', () => ({
    ModerationService: { getCached: jest.fn(), fromActiveVotes: jest.fn() },
}));

import { findNewSnaps, isModerationBlocked, matchesFeedFilter } from '../feedFilter';
import { ModerationService } from '../../services/ModerationService';

const snap = (author: string, created: string, permlink = `${author}-${created}`) => ({ author, permlink, created });

describe('matchesFeedFilter', () => {
    const following = new Set(['alice']);
    const patrons = new Set(['pat']);

    it('narrows Following and Patrons by author', () => {
        expect(matchesFeedFilter({ author: 'alice' }, 'following', following, patrons)).toBe(true);
        expect(matchesFeedFilter({ author: 'bob' }, 'following', following, patrons)).toBe(false);
        expect(matchesFeedFilter({ author: 'pat' }, 'patrons', following, patrons)).toBe(true);
        expect(matchesFeedFilter({ author: 'alice' }, 'patrons', following, patrons)).toBe(false);
    });

    it('shows everyone on Newest and Trending', () => {
        expect(matchesFeedFilter({ author: 'bob' }, 'newest', following, patrons)).toBe(true);
        expect(matchesFeedFilter({ author: 'bob' }, 'trending', following, patrons)).toBe(true);
    });
});

describe('isModerationBlocked', () => {
    beforeEach(() => jest.resetAllMocks());

    it('uses a cached verdict first', () => {
        (ModerationService.getCached as jest.Mock).mockReturnValue({ isBlocked: true });
        expect(isModerationBlocked(snap('a', '2026-11-19T10:00:00'))).toBe(true);
    });

    it('derives a verdict from active_votes when present', () => {
        (ModerationService.fromActiveVotes as jest.Mock).mockReturnValue({ isBlocked: true });
        expect(isModerationBlocked({ ...snap('a', '2026-11-19T10:00:00'), active_votes: [] })).toBe(true);
        expect(isModerationBlocked(snap('a', '2026-11-19T10:00:00'))).toBe(false);
    });
});

describe('findNewSnaps', () => {
    const known = [snap('alice', '2026-11-19T10:00:00'), snap('bob', '2026-11-19T09:00:00')];
    const all = (): boolean => true;

    it('returns snaps newer than the newest known one, newest first', () => {
        const latest = [
            snap('carol', '2026-11-19T10:05:00'),
            snap('dave', '2026-11-19T10:01:00'),
            ...known,
            snap('erin', '2026-11-19T08:00:00'),
        ];
        expect(findNewSnaps(latest, known, all).map((s) => s.author)).toEqual(['carol', 'dave']);
    });

    it('skips known snaps, your own snaps, duplicates and ones the view hides', () => {
        const latest = [
            snap('me', '2026-11-19T10:06:00'),
            snap('muted', '2026-11-19T10:05:00'),
            snap('carol', '2026-11-19T10:04:00', 'p1'),
            snap('carol', '2026-11-19T10:04:00', 'p1'),
            { ...known[0] },
        ];
        const result = findNewSnaps(latest, known, (s) => s.author !== 'muted', 'me');
        expect(result.map((s) => s.permlink)).toEqual(['p1']);
    });

    it('reports nothing before the feed has loaded', () => {
        expect(findNewSnaps([snap('carol', '2026-11-19T10:05:00')], [], all)).toEqual([]);
    });
});
