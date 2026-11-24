import { compareVersions, entriesForApp, parseChangelog, unseenEntries, type ChangelogEntry } from '../changelog';
import bundled from '../../changelog/changelog.json';
import appJson from '../../app.json';

const entry = (version: string): ChangelogEntry => ({ version, date: '2026-01-01', items: [{ type: 'feature', text: `in ${version}` }] });
const all = [entry('1.6.0'), entry('1.5.0'), entry('1.4.0')];

describe('compareVersions', () => {
    it.each([
        ['1.4.0', '1.4.0', 0],
        ['1.10.0', '1.4.0', 1],
        ['1.4', '1.4.0', 0],
        ['1.3.9', '1.4.0', -1],
        ['2', '1.99.99', 1],
    ])('%s vs %s → %d', (a, b, out) => expect(compareVersions(a, b)).toBe(out));
});

describe('parseChangelog', () => {
    it('keeps well-formed entries and items, newest version first', () => {
        const parsed = parseChangelog({
            entries: [
                { version: '1.4.0', date: '2026-11-24', items: [{ type: 'fix', text: 'ok' }, { type: 'bogus', text: 'x' }, { type: 'feature', text: ' ' }] },
                { version: '1.10.0', date: '2027-01-01', title: 'Big', items: [{ type: 'feature', text: 'new' }] },
                { version: 'next', date: '2026-01-01', items: [{ type: 'fix', text: 'x' }] },
                { version: '1.5.0', date: '2026-12-01', items: [] },
                null,
            ],
        });
        expect(parsed.map((e) => e.version)).toEqual(['1.10.0', '1.4.0']);
        expect(parsed[1].items).toEqual([{ type: 'fix', text: 'ok' }]);
        expect(parsed[0].title).toBe('Big');
    });

    it('returns nothing for junk', () => {
        expect(parseChangelog(null)).toEqual([]);
        expect(parseChangelog({ entries: 'no' })).toEqual([]);
    });
});

it('only offers entries for versions the app has', () => {
    expect(entriesForApp(all, '1.5.0').map((e) => e.version)).toEqual(['1.5.0', '1.4.0']);
});

describe('unseenEntries', () => {
    it('shows only the installed version when nothing was seen yet', () => {
        expect(unseenEntries(all, '1.5.0', null).map((e) => e.version)).toEqual(['1.5.0']);
        expect(unseenEntries(all, '1.4.5', null)).toEqual([]);
    });

    it('shows every version since the last one seen, but none newer than the app', () => {
        expect(unseenEntries(all, '1.6.0', '1.4.0').map((e) => e.version)).toEqual(['1.6.0', '1.5.0']);
        expect(unseenEntries(all, '1.5.0', '1.4.0').map((e) => e.version)).toEqual(['1.5.0']);
        expect(unseenEntries(all, '1.5.0', '1.5.0')).toEqual([]);
    });
});

describe('changelog/changelog.json', () => {
    const raw = bundled as { entries: { items: unknown[] }[] };

    it('parses without dropping any entry or item (catches typos in the type field)', () => {
        const parsed = parseChangelog(bundled);
        expect(parsed).toHaveLength(raw.entries.length);
        expect(parsed.reduce((n, e) => n + e.items.length, 0)).toBe(raw.entries.reduce((n, e) => n + e.items.length, 0));
    });

    it('has notes for the version in app.json', () => {
        expect(parseChangelog(bundled).some((e) => compareVersions(e.version, appJson.expo.version) === 0)).toBe(true);
    });
});
