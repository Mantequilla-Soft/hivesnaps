import { generatePostPermlink, parseHiveTags } from '../blogPostUtils';

describe('generatePostPermlink', () => {
  it('slugifies a normal title and appends a numeric suffix', () => {
    const permlink = generatePostPermlink('My First Blog Post');
    expect(permlink).toMatch(/^my-first-blog-post-\d{6}$/);
  });

  it('strips punctuation and collapses whitespace', () => {
    const permlink = generatePostPermlink("Let's Go!  Hive Rocks??");
    expect(permlink).toMatch(/^lets-go-hive-rocks-\d{6}$/);
  });

  it('collapses repeated hyphens and trims leading/trailing ones', () => {
    const permlink = generatePostPermlink('--Weird---Title--');
    expect(permlink).toMatch(/^weird-title-\d{6}$/);
  });

  it('falls back to a generic slug when the title has no usable characters', () => {
    const permlink = generatePostPermlink('!!!???');
    expect(permlink).toMatch(/^post-\d{6}$/);
  });

  it('falls back to a generic slug for an empty title', () => {
    const permlink = generatePostPermlink('   ');
    expect(permlink).toMatch(/^post-\d{6}$/);
  });
});

describe('parseHiveTags', () => {
  it('splits on whitespace and lowercases tags', () => {
    expect(parseHiveTags('Photography Travel Hive')).toEqual([
      'photography',
      'travel',
      'hive',
    ]);
  });

  it('splits on commas and hashes too', () => {
    expect(parseHiveTags('#Photography, #travel,hive')).toEqual([
      'photography',
      'travel',
      'hive',
    ]);
  });

  it('strips characters that are not valid in a Hive tag', () => {
    expect(parseHiveTags('art! deco_style café')).toEqual([
      'art',
      'decostyle',
      'caf',
    ]);
  });

  it('dedupes repeated tags', () => {
    expect(parseHiveTags('hive Hive HIVE')).toEqual(['hive']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseHiveTags('   ')).toEqual([]);
  });
});
