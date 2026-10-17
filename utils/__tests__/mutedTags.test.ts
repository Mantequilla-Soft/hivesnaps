import { hasMutedTag, normalizeTag } from '../mutedTags';

describe('normalizeTag', () => {
  it('strips #, trims and lowercases', () => {
    expect(normalizeTag('  ##ScrobbleLife ')).toBe('scrobblelife');
  });
});

describe('hasMutedTag', () => {
  const meta = JSON.stringify({ tags: ['hive-178315', 'ScrobbleLife'] });

  it('matches a JSON string case-insensitively', () => {
    expect(hasMutedTag(meta, ['scrobblelife'])).toBe(true);
  });

  it('matches an already-parsed object', () => {
    expect(hasMutedTag({ tags: ['scrobblelife'] }, ['#ScrobbleLife'])).toBe(true);
  });

  it('returns false when no tag overlaps', () => {
    expect(hasMutedTag(meta, ['gaming'])).toBe(false);
  });

  it('returns false for an empty mute list', () => {
    expect(hasMutedTag(meta, [])).toBe(false);
  });

  it('returns false for missing, malformed or tagless metadata', () => {
    expect(hasMutedTag(undefined, ['x'])).toBe(false);
    expect(hasMutedTag('{not json', ['x'])).toBe(false);
    expect(hasMutedTag('{}', ['x'])).toBe(false);
    expect(hasMutedTag({ tags: 'x' }, ['x'])).toBe(false);
  });
});

describe('normalizeTag spacing', () => {
  it('trims whitespace left after the #', () => {
    expect(normalizeTag('# foo')).toBe('foo');
  });
});
