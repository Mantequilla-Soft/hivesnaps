/**
 * Tests for the markdown linkification pipeline.
 *
 * Root cause of bugs fixed by this suite:
 *   1. linkifyMentions lived only in Snap.tsx; preprocessForMarkdown had its
 *      own @username regex that ran AFTER linkifyMentions and corrupted the
 *      already-formed links into invalid nested syntax, causing raw markdown
 *      text to appear in the UI.
 *   2. linkifyUrls had a broken context guard that tested the URL string
 *      itself rather than the surrounding text, so [text](url) links written
 *      by users were double-wrapped into [text]([url](url)).
 */

import { linkifyMentions } from '../utils/linkifyMentions';
import { linkifyUrls } from '../utils/linkifyUrls';
import { preprocessForMarkdown } from '../utils/htmlPreprocessing';

// ---------------------------------------------------------------------------
// linkifyMentions
// ---------------------------------------------------------------------------
describe('linkifyMentions', () => {
  it('wraps a bare @mention into a profile:// markdown link', () => {
    expect(linkifyMentions('Hello @alice!')).toBe(
      'Hello [@alice](profile://alice)!'
    );
  });

  it('handles a mention at the very start of the string', () => {
    expect(linkifyMentions('@bob said hi')).toBe(
      '[@bob](profile://bob) said hi'
    );
  });

  it('handles multiple mentions in one string', () => {
    const result = linkifyMentions('Thanks @alice and @bob!');
    expect(result).toContain('[@alice](profile://alice)');
    expect(result).toContain('[@bob](profile://bob)');
  });

  it('does NOT re-wrap a mention already inside a markdown link', () => {
    // This is the core regression: content stored on-chain by other Hive
    // clients (e.g. Ecency) already contains [@user](profile://user) syntax.
    const already = '[@bitterirony](profile://bitterirony) said something';
    expect(linkifyMentions(already)).toBe(already);
  });

  it('does NOT re-wrap when the full markdown link is in a sentence', () => {
    const input =
      'I thought [@steevc](profile://steevc) had a point about this.';
    expect(linkifyMentions(input)).toBe(input);
  });

  it('does NOT match email addresses (@ preceded by word character)', () => {
    expect(linkifyMentions('contact user@example.com please')).toBe(
      'contact user@example.com please'
    );
  });

  it('does NOT match @username preceded by a slash (e.g. inside a URL path)', () => {
    expect(linkifyMentions('https://hive.blog/@alice/my-post')).toBe(
      'https://hive.blog/@alice/my-post'
    );
  });

  it('ignores usernames shorter than 3 characters', () => {
    expect(linkifyMentions('hey @ab there')).toBe('hey @ab there');
  });

  it('ignores usernames longer than 16 characters', () => {
    expect(linkifyMentions('@averylongusernamethatexceeds')).toBe(
      '@averylongusernamethatexceeds'
    );
  });

  it('does NOT match handles with a leading hyphen (@-alice)', () => {
    expect(linkifyMentions('hey @-alice there')).toBe('hey @-alice there');
  });

  it('does NOT match handles with a trailing hyphen (@alice-)', () => {
    expect(linkifyMentions('hey @alice- there')).toBe('hey @alice- there');
  });

  it('normalises uppercase mentions to lowercase', () => {
    expect(linkifyMentions('Hello @Alice!')).toBe(
      'Hello [@alice](profile://alice)!'
    );
  });

  it('does NOT wrap a URL inside an HTML href with uppercase HREF', () => {
    const input = '<a HREF="https://example.com">click</a>';
    expect(linkifyUrls(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// linkifyUrls
// ---------------------------------------------------------------------------
describe('linkifyUrls', () => {
  it('wraps a bare URL in a markdown link', () => {
    const result = linkifyUrls('Visit https://puppy.com for more');
    expect(result).toContain('[https://puppy.com](https://puppy.com)');
  });

  it('does NOT double-wrap a URL already inside a markdown link', () => {
    // This was the bug: [My blog](https://puppy.com) was being mangled into
    // [My blog]([https://puppy.com](https://puppy.com))
    const input = '[My favorite puppy blog](https://puppy.com)';
    expect(linkifyUrls(input)).toBe(input);
  });

  it('does NOT double-wrap a URL already inside a markdown link mid-sentence', () => {
    const input = 'Check out [this site](https://example.com) for details.';
    expect(linkifyUrls(input)).toBe(input);
  });

  it('does NOT double-wrap a markdown link that includes a title attribute', () => {
    const input = '[Example](https://example.com "site title")';
    expect(linkifyUrls(input)).toBe(input);
  });

  it('does NOT wrap a URL that is itself the link text of a markdown link', () => {
    // e.g. auto-linked URL displayed as itself: [https://example.com](https://example.com)
    const input = '[https://example.com](https://example.com)';
    expect(linkifyUrls(input)).toBe(input);
  });

  it('does NOT wrap a URL inside an HTML href attribute', () => {
    const input = '<a href="https://example.com">click</a>';
    expect(linkifyUrls(input)).toBe(input);
  });

  it('does NOT wrap a URL inside an HTML href attribute without quotes', () => {
    const input = "<a href='https://example.com'>click</a>";
    expect(linkifyUrls(input)).toBe(input);
  });

  it('leaves YouTube URLs unwrapped (handled by the video renderer)', () => {
    const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(linkifyUrls(yt)).toBe(yt);
  });

  it('leaves Hive post URLs unwrapped (handled by the post-preview renderer)', () => {
    const hive = 'https://peakd.com/@alice/my-great-post';
    expect(linkifyUrls(hive)).toBe(hive);
  });

  it('truncates display text for long URLs', () => {
    const long =
      'https://example.com/this/is/a/very/long/path/that/exceeds/fifty/characters/total';
    const result = linkifyUrls(long);
    // Should be wrapped and display text should be truncated with ellipsis
    expect(result).toMatch(/\[.*\.\.\.\]\(https:\/\/example\.com/);
  });
});

// ---------------------------------------------------------------------------
// preprocessForMarkdown — regression: must NOT re-linkify @mentions
// ---------------------------------------------------------------------------
describe('preprocessForMarkdown — mention regression', () => {
  it('does NOT convert bare @username (linkifyMentions is responsible for that)', () => {
    // preprocessForMarkdown should only convert HTML tags; mention linkification
    // was removed from it to prevent double-processing when used after linkifyMentions.
    const result = preprocessForMarkdown('Hello @alice today');
    expect(result).toBe('Hello @alice today');
  });

  it('does NOT corrupt an already-linked mention produced by linkifyMentions', () => {
    // Simulate the pipeline: linkifyMentions runs first, then preprocessForMarkdown.
    // The combined output must still be valid markdown.
    const afterMentions = linkifyMentions(
      '[@bitterirony](profile://bitterirony) said it'
    );
    const final = preprocessForMarkdown(afterMentions);
    // Must remain a single, well-formed markdown link — no double brackets
    expect(final).toBe(
      '[@bitterirony](profile://bitterirony) said it'
    );
    expect(final).not.toContain('[[');
  });

  it('does NOT corrupt a mention that was bare before linkifyMentions ran', () => {
    const afterMentions = linkifyMentions('@steevc mentioned something');
    const final = preprocessForMarkdown(afterMentions);
    expect(final).toBe('[@steevc](profile://steevc) mentioned something');
    expect(final).not.toContain('[[');
  });

  it('still converts HTML bold tags to markdown', () => {
    expect(preprocessForMarkdown('<b>bold</b>')).toBe('**bold**');
  });

  it('still converts HTML line breaks to newlines', () => {
    expect(preprocessForMarkdown('line one<br>line two')).toBe(
      'line one\n\nline two'
    );
  });

  it('still converts HTML anchor tags to markdown links', () => {
    expect(
      preprocessForMarkdown('<a href="https://example.com">click here</a>')
    ).toBe('[click here](https://example.com)');
  });
});
