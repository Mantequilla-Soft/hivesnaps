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
      // A URL is already inside a markdown link [text](url) when the character
      // immediately before it is '(' and immediately after it is ')'.
      const charBefore = string[offset - 1];
      const charAfter = string[offset + url.length];
      if (charBefore === '(' && charAfter === ')') return url;

      // Also skip HTML href attributes
      const nearby = string.substring(Math.max(0, offset - 8), offset);
      if (/href=["']?$/.test(nearby)) return url;

      const urlInfo = classifyUrl(url);

      if (urlInfo.type === 'normal') {
        return `[${urlInfo.displayText || url}](${url})`;
      }

      // hive_post, embedded_media, invalid — leave for their own renderers
      return url;
    }
  );
}
