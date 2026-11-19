import {
    buildPostingJsonMetadata,
    cleanProfileFields,
    normalizeWebsite,
    profileFieldsError,
    readProfileFields,
    EMPTY_PROFILE,
    type ProfileFields,
} from '../profileMetadata';

const fields = (over: Partial<ProfileFields> = {}): ProfileFields => ({ ...EMPTY_PROFILE, ...over });

describe('readProfileFields', () => {
    it('prefers the posting_json_metadata profile', () => {
        const account = {
            posting_json_metadata: JSON.stringify({ profile: { name: 'Posting', about: 'a', website: 'https://x.io' } }),
            json_metadata: JSON.stringify({ profile: { name: 'Legacy', location: 'Old town' } }),
        };
        expect(readProfileFields(account)).toEqual(fields({ name: 'Posting', about: 'a', website: 'https://x.io' }));
    });

    it('falls back to json_metadata, and tolerates junk', () => {
        expect(readProfileFields({ posting_json_metadata: '{bad', json_metadata: JSON.stringify({ profile: { name: 'Legacy' } }) }).name).toBe('Legacy');
        expect(readProfileFields({ posting_json_metadata: '[]', json_metadata: '' })).toEqual(EMPTY_PROFILE);
        expect(readProfileFields({ posting_json_metadata: JSON.stringify({ profile: { name: 42 } }) }).name).toBe('');
    });
});

describe('normalizeWebsite', () => {
    it.each([
        ['', ''],
        ['  ', ''],
        ['example.com', 'https://example.com'],
        ['http://example.com/path?q=1', 'http://example.com/path?q=1'],
        ['HTTPS://Sub.Example.io', 'HTTPS://Sub.Example.io'],
    ])('%p → %p', (input, out) => expect(normalizeWebsite(input)).toBe(out));

    it.each(['example', 'not a url.com', 'ftp://example.com', 'https://'])('rejects %p', (input) => expect(normalizeWebsite(input)).toBeNull());
});

describe('profileFieldsError', () => {
    it('accepts valid fields', () => {
        expect(profileFieldsError(fields({ name: 'Meno', website: 'snapie.io' }))).toBeNull();
    });

    it('flags over-long fields and bad websites', () => {
        expect(profileFieldsError(fields({ name: 'x'.repeat(21) }))).toMatch(/Display name/);
        expect(profileFieldsError(fields({ about: 'x'.repeat(161) }))).toMatch(/About/);
        expect(profileFieldsError(fields({ location: 'x'.repeat(31) }))).toMatch(/Location/);
        expect(profileFieldsError(fields({ website: 'nope' }))).toMatch(/web address/);
        expect(profileFieldsError(fields({ website: `${'a'.repeat(95)}.com` }))).toMatch(/at most 100/);
    });
});

it('cleanProfileFields trims and normalizes the website', () => {
    expect(cleanProfileFields(fields({ name: ' Meno ', website: ' snapie.io ' }))).toEqual(fields({ name: 'Meno', website: 'https://snapie.io' }));
});

describe('buildPostingJsonMetadata', () => {
    it('keeps every other key, top level and inside profile', () => {
        const account = {
            posting_json_metadata: JSON.stringify({
                profile: { name: 'Old', pinned: 'post-1', dtube_pub: 'abc', version: 2 },
                peakd: { theme: 'dark' },
                beneficiaries: [{ name: 'x', weight: 100 }],
            }),
        };
        const out = JSON.parse(buildPostingJsonMetadata(account, fields({ name: 'New', about: 'Hi' })));
        expect(out.peakd).toEqual({ theme: 'dark' });
        expect(out.beneficiaries).toEqual([{ name: 'x', weight: 100 }]);
        expect(out.profile).toEqual({
            ...fields({ name: 'New', about: 'Hi' }),
            pinned: 'post-1',
            dtube_pub: 'abc',
            version: 2,
        });
    });

    it('starts from the legacy json_metadata profile when posting has none', () => {
        const account = {
            posting_json_metadata: JSON.stringify({ other: true }),
            json_metadata: JSON.stringify({ profile: { name: 'Legacy', witness_description: 'w' } }),
        };
        const out = JSON.parse(buildPostingJsonMetadata(account, fields({ name: 'New' })));
        expect(out.other).toBe(true);
        expect(out.profile.witness_description).toBe('w');
        expect(out.profile.name).toBe('New');
    });

    it('builds a fresh object from nothing', () => {
        expect(JSON.parse(buildPostingJsonMetadata({}, fields({ name: 'A' })))).toEqual({ profile: { ...fields({ name: 'A' }), version: 2 } });
    });
});
