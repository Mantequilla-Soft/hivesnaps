// Render Hive markdown+HTML to sanitized HTML using Ecency render-helper
// This isolates library usage so we can tune options later or swap implementations.

import { renderPostBody, setProxyBase } from '@ecency/render-helper';

export interface RenderHiveOptions {
  // Whether to convert line breaks to <br/>
  breaks?: boolean;
  // Proxy images via Ecency CDN (we generally keep off for RN)
  proxifyImages?: boolean;
}

export function renderHiveToHtml(
  raw: string,
  options: RenderHiveOptions = {}
): string {
  const { breaks = true, proxifyImages = false } = options;

  // Configure image proxy base only if requested
  if (proxifyImages) {
    try {
      setProxyBase('https://images.ecency.com');
    } catch {}
  }

  // renderPostBody: (objOrString, forApp=true, webp=false)
  // Some RN environments return empty string with forApp=true. Fallback to forApp=false.
  let html = renderPostBody(raw || '', true, false);
  if (!html || (typeof html === 'string' && html.trim().length === 0)) {
    html = renderPostBody(raw || '', false, false);
  }

  const result = typeof html === 'string' ? html : String(html ?? '');
  return sanitizeEcencyHtml(result);
}

/**
 * Ecency's renderPostBody (forApp=true) stores URLs in data-href instead of href,
 * and mangles non-http schemes by prepending "https://" (e.g. hashtag://hive →
 * https://hashtag://hive). Fix both so react-native-render-html can handle links.
 */
function sanitizeEcencyHtml(html: string): string {
  return (
    html
      // data-href="https://hashtag://tag" → href="hashtag://tag"
      .replace(/data-href="https?:\/\/(hashtag:\/\/[^"]+)"/gi, 'href="$1"')
      // data-href="https://profile://user" → href="profile://user"
      .replace(/data-href="https?:\/\/(profile:\/\/[^"]+)"/gi, 'href="$1"')
      // data-href="https://..." → href="https://..."
      .replace(/data-href="(https?:\/\/[^"]+)"/gi, 'href="$1"')
      // Any remaining data-href → href (catch-all)
      .replace(/data-href="([^"]*)"/gi, 'href="$1"')
  );
}
