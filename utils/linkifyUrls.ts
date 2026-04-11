import { classifyUrl } from './urlClassifier';

/**
 * Wrap bare HTTP(S) URLs in markdown link syntax so they render as clickable
 * links through react-native-markdown-display.
 *
 * Skips URLs that are already the href of a markdown link [text](url) or an
 * HTML href attribute, to prevent double-wrapping which produces invalid nested
 * link syntax and causes the renderer to show raw text.
 *
 * Non-normal URLs (Hive posts, embedded media, YouTube, etc.) are returned
 * unchanged so their dedicated renderers can handle them.
 */
export function linkifyUrls(text: string): string {
  return text.replace(
    /(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi,
    (url, _p1, offset: number, string: string) => {
      const charBefore = string[offset - 1];
      const beforeMatch = string.slice(0, offset);
      const afterMatch = string.slice(offset + url.length);

      // Skip if the URL appears as the text part of a markdown link:
      // [ https://... ](...) — more open brackets than close before this point.
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets && afterMatch.includes('](')) return url;

      // Skip if the URL is the href of a markdown link, including optional
      // title: [text](https://... "optional title") or [text](https://...)
      if (
        charBefore === '(' &&
        /^\s*(?:"[^"]*"|'[^']*'|\([^)]*\))?\)/.test(afterMatch)
      ) {
        return url;
      }

      // Skip HTML href attributes — case-insensitive, allows whitespace around =
      const nearby = string.substring(Math.max(0, offset - 24), offset);
      if (/\bhref\s*=\s*["']?$/i.test(nearby)) return url;

      const urlInfo = classifyUrl(url);

      if (urlInfo.type === 'normal') {
        return `[${urlInfo.displayText || url}](${url})`;
      }

      // hive_post, embedded_media, invalid — leave for their own renderers
      return url;
    }
  );
}
