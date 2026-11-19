import {
    beneficiaryError,
    buildBeneficiaries,
    formatPercent,
    parsePercent,
    remainingWeight,
    snapieShare,
    MAX_BENEFICIARIES,
} from '../beneficiaries';
import { normalizeUsername } from '../hiveUsername';

const ctx = { author: 'meno', snapieWeight: 300 };

describe('parsePercent', () => {
    it.each([
        ['10', 1000],
        ['12.5', 1250],
        ['0,5', 50],
        ['0.01', 1],
        [' 100 ', 10000],
    ])('%s → %d basis points', (input, bp) => expect(parsePercent(input)).toBe(bp));

    it.each(['', '0', '100.01', '-5', 'abc', '1.234', '5%'])('rejects %p', (input) => expect(parsePercent(input)).toBeNull());
});

it('formats basis points as a percentage', () => {
    expect(formatPercent(300)).toBe('3%');
    expect(formatPercent(1250)).toBe('12.5%');
    expect(formatPercent(1)).toBe('0.01%');
});

it('snapie gets 10% with media, 3% otherwise', () => {
    expect(snapieShare(true)).toBe(1000);
    expect(snapieShare(false)).toBe(300);
});

it('normalizes typed account names', () => {
    expect(normalizeUsername('  @Alice ')).toBe('alice');
});

describe('beneficiaryError', () => {
    it('accepts a valid new beneficiary', () => {
        expect(beneficiaryError([], 'alice', 1000, ctx)).toBeNull();
    });

    it('rejects bad names, the author, @snapie and duplicates', () => {
        expect(beneficiaryError([], '', 1000, ctx)).toMatch(/Enter/);
        expect(beneficiaryError([], 'a', 1000, ctx)).toMatch(/valid/);
        expect(beneficiaryError([], 'bad_name', 1000, ctx)).toMatch(/valid/);
        expect(beneficiaryError([], 'meno', 1000, ctx)).toMatch(/author/);
        expect(beneficiaryError([], 'snapie', 1000, ctx)).toMatch(/already gets 3%/);
        expect(beneficiaryError([{ account: 'alice', weight: 100 }], 'alice', 100, ctx)).toMatch(/already/);
    });

    it('rejects a missing percentage and anything over what is left', () => {
        expect(beneficiaryError([], 'alice', null, ctx)).toMatch(/percentage/);
        expect(beneficiaryError([{ account: 'bob', weight: 9000 }], 'alice', 701, ctx)).toBe('Only 7% is left to share.');
        expect(beneficiaryError([{ account: 'bob', weight: 9000 }], 'alice', 700, ctx)).toBeNull();
    });

    it('keeps one of the 8 slots for @snapie', () => {
        const seven = Array.from({ length: MAX_BENEFICIARIES - 1 }, (_, i) => ({ account: `user${i}x`, weight: 10 }));
        expect(beneficiaryError(seven.slice(1), 'alice', 10, ctx)).toBeNull();
        expect(beneficiaryError(seven, 'alice', 10, ctx)).toMatch(/at most 8/);
    });
});

it('remainingWeight never goes below zero', () => {
    expect(remainingWeight([{ account: 'bob', weight: 2000 }], 300)).toBe(7700);
    expect(remainingWeight([{ account: 'bob', weight: 9500 }], 1000)).toBe(0);
});

describe('buildBeneficiaries', () => {
    it('adds @snapie, merges duplicates and sorts by account name', () => {
        expect(
            buildBeneficiaries(
                [
                    { account: 'zed', weight: 500 },
                    { account: 'Alice', weight: 200 },
                    { account: 'alice', weight: 100 },
                    { account: 'snapie', weight: 100 },
                    { account: 'a-b', weight: 50 },
                    { account: 'a.b', weight: 50 },
                ],
                300
            )
        ).toEqual([
            { account: 'a-b', weight: 50 },
            { account: 'a.b', weight: 50 },
            { account: 'alice', weight: 300 },
            { account: 'snapie', weight: 400 },
            { account: 'zed', weight: 500 },
        ]);
    });

    it('omits @snapie when its share is zero', () => {
        expect(buildBeneficiaries([{ account: 'alice', weight: 100 }], 0)).toEqual([{ account: 'alice', weight: 100 }]);
    });

    it('throws instead of broadcasting something Hive would reject', () => {
        expect(() => buildBeneficiaries([{ account: 'alice', weight: 9800 }], 300)).toThrow(/100%/);
        const eight = Array.from({ length: 8 }, (_, i) => ({ account: `user${i}x`, weight: 10 }));
        expect(() => buildBeneficiaries(eight, 300)).toThrow(/at most 8/);
        expect(() => buildBeneficiaries([{ account: 'bad_name', weight: 10 }], 300)).toThrow(/Invalid/);
        expect(() => buildBeneficiaries([{ account: 'alice', weight: 10.5 }], 300)).toThrow(/Invalid/);
    });
});
