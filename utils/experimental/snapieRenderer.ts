/**
 * SPIKE — not wired into the app. Do not import from screens/components yet.
 *
 * Port of @snapie/renderer (menosoft/snapie-io/packages/renderer) for React
 * Native. The published package is web-only: it sanitizes with
 * isomorphic-dompurify, which falls back to jsdom off-browser — jsdom needs
 * Node's native bindings and does not run under Hermes. Everything else in
 * the original package is pure string/regex transforms layered on top of
 * @hiveio/content-renderer's DefaultRenderer (itself pure JS — verified no
 * `window`/`document` references in its Node build), so this port keeps that
 * logic verbatim and swaps only the sanitization step for `xss`, the same
 * pure-JS, DOM-free sanitizer hivesnaps' own @ecency/render-helper already
 * uses successfully in this app (see utils/renderHive.ts).
 *
 * NOT ported: Hivemoji (:emoji: token) support. The original implementation
 * walks a real DOM tree (doc.createTreeWalker, Document/Text/DocumentFragment
 * APIs) via DOMPurify's RETURN_DOM_FRAGMENT mode, which has no equivalent
 * without a real DOM. hivesnaps doesn't use this feature today
 * (enableHivemoji defaults to false upstream too), so it's just omitted here
 * rather than reimplemented string-wise — if wanted later, it needs its own
 * regex-based pass over the HTML string instead of DOM manipulation.
 *
 * Also not yet ported: the three DOMPurify `uponSanitizeAttribute` hooks from
 * the original (strip position/z-index from style; block private/loopback
 * image+iframe src hosts; strip autoplay query params from embed src). These
 * are pure string/attribute-value logic, not actually DOM-dependent — they
 * were only wired through DOMPurify's hook API for convenience. Porting them
 * is straightforward via xss's `safeAttrValue` option but is left for a
 * follow-up once/if this spike is adopted, to keep this prototype focused on
 * answering the one open question: does the core pipeline run under Hermes
 * and produce better output than PostBody.tsx's current approach.
 */

import { DefaultRenderer } from '@hiveio/content-renderer';
import { filterXSS } from 'xss';

export interface SnapieHiveRendererOptions {
  baseUrl?: string;
  ipfsGateway?: string;
  ipfsFallbackGateways?: string[];
  usertagUrlFn?: (account: string) => string;
  hashtagUrlFn?: (hashtag: string) => string;
  additionalHiveFrontends?: string[];
  convertHiveUrls?: boolean;
  internalUrlPrefix?: string;
  assetsWidth?: number;
  assetsHeight?: number;
  imageProxyFn?: (url: string) => string;
}

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.3speak.tv';
const DEFAULT_IPFS_FALLBACKS = [
  'https://ipfs.skatehive.app',
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
];

const DEFAULT_HIVE_FRONTENDS = [
  'peakd.com',
  'ecency.com',
  'hive.blog',
  'hiveblog.io',
  'leofinance.io',
  '3speak.tv',
  'd.tube',
  'esteem.app',
  'busy.org',
];

// Mirrors @snapie/renderer's DOMPURIFY_CONFIG allow-list, translated to xss's
// whiteList shape (tag -> allowed attribute names).
const XSS_WHITELIST: Record<string, string[]> = {
  p: ['style'], br: [], span: ['style', 'class'], div: ['style', 'class'],
  blockquote: [], pre: [], code: [],
  strong: [], em: [], b: [], i: [], u: [], ins: [], del: [], s: [], strike: [],
  mark: [], sub: [], sup: [], small: [],
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  ul: [], ol: ['start', 'reversed'], li: [], dl: [], dt: [], dd: [],
  table: [], thead: [], tbody: [], tfoot: [],
  tr: [], th: ['colspan', 'rowspan', 'align', 'valign'], td: ['colspan', 'rowspan', 'align', 'valign'],
  caption: [], col: [], colgroup: [],
  a: ['href', 'title', 'target', 'rel', 'class'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'style', 'class'],
  video: ['src', 'width', 'height', 'controls', 'muted', 'preload', 'loop', 'style'],
  source: ['src', 'type'],
  audio: ['src', 'controls', 'muted', 'preload', 'style'],
  iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'scrolling', 'allowtransparency', 'loading', 'style'],
  hr: [], center: [], details: [], summary: [],
};

const STRIP_TAG_BODY = ['script', 'style', 'form', 'input', 'button', 'textarea', 'select', 'dialog', 'object', 'embed', 'applet', 'base', 'link', 'meta'];

function sanitize(html: string): string {
  return filterXSS(html, {
    whiteList: XSS_WHITELIST,
    stripIgnoreTag: true,
    stripIgnoreTagBody: STRIP_TAG_BODY,
    onIgnoreTagAttr: (tag, name) => {
      // Drop event-handler attributes outright regardless of value.
      if (/^on/i.test(name)) return '';
      return undefined; // fall through to default handling
    },
  });
}

function fixMalformedCenterTags(content: string): string {
  return content.replace(
    /<p><center>([\s\S]*?)<hr \/>([\s\S]*?)<\/center><\/p>/gi,
    (_match, beforeHr, afterHr) => `<center>${beforeHr.trim()}</center><hr />${afterHr.trim()}`
  );
}

function transform3SpeakContent(content: string): string {
  const embeddedVideos = new Set<string>();
  const embeddedAudios = new Set<string>();

  content = fixMalformedCenterTags(content);

  const SPEAK_VIDEO_ALLOW = 'allow="autoplay; encrypted-media; fullscreen; picture-in-picture"';

  content = content.replace(
    /<iframe[^>]*\bsrc="(https?:\/\/(?:play\.)?3speak\.tv\/(?:watch|embed)\?v=([^"&]+)[^"]*)"[^>]*>(?:\s*<\/iframe>)?/gi,
    (_match, _fullUrl, videoId) => {
      let decoded: string;
      try { decoded = decodeURIComponent(videoId); } catch { decoded = videoId; }
      if (embeddedVideos.has(decoded)) return '';
      embeddedVideos.add(decoded);
      const embedUrl = `https://play.3speak.tv/watch?v=${decoded}&mode=iframe&captions=0&layout=desktop`;
      return `<div class="video-container"><iframe src="${embedUrl}" ${SPEAK_VIDEO_ALLOW} allowfullscreen></iframe></div>`;
    }
  );

  const isAutoLinkedUrl = (fullUrl: string, innerHtml: string): boolean => {
    const textOnly = innerHtml.replace(/<[^>]*>/g, '').trim();
    const clean = fullUrl.replace(/&amp;/gi, '&').trim();
    return textOnly === clean || textOnly === fullUrl.trim();
  };

  content = content.replace(
    /<a[^>]*href="(https?:\/\/3speak\.tv\/watch\?v=([^"&]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
    (match, fullUrl, videoId, innerHtml) => {
      if (!isAutoLinkedUrl(fullUrl, innerHtml)) return match;
      if (embeddedVideos.has(videoId)) return match;
      embeddedVideos.add(videoId);
      const embedUrl = `https://play.3speak.tv/watch?v=${videoId}&mode=iframe&captions=0&layout=desktop`;
      return `<div class="video-container"><iframe src="${embedUrl}" ${SPEAK_VIDEO_ALLOW} allowfullscreen></iframe></div>`;
    }
  );

  content = content.replace(
    /<a[^>]*href="(https?:\/\/play\.3speak\.tv\/watch\?v=([^"&]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
    (match, fullUrl, videoId, innerHtml) => {
      if (!isAutoLinkedUrl(fullUrl, innerHtml)) return match;
      if (embeddedVideos.has(videoId)) return match;
      embeddedVideos.add(videoId);
      const embedUrl = `https://play.3speak.tv/watch?v=${videoId}&mode=iframe&captions=0&layout=desktop`;
      return `<div class="video-container"><iframe src="${embedUrl}" ${SPEAK_VIDEO_ALLOW} allowfullscreen></iframe></div>`;
    }
  );

  content = content.replace(
    /<a[^>]*href="(https?:\/\/play\.3speak\.tv\/embed\?v=([^"&]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
    (match, fullUrl, videoId, innerHtml) => {
      if (!isAutoLinkedUrl(fullUrl, innerHtml)) return match;
      if (embeddedVideos.has(videoId)) return match;
      embeddedVideos.add(videoId);
      const embedUrl = `https://play.3speak.tv/embed?v=${videoId}&mode=iframe&captions=0&layout=desktop`;
      return `<div class="video-container"><iframe src="${embedUrl}" ${SPEAK_VIDEO_ALLOW} allowfullscreen></iframe></div>`;
    }
  );

  content = content.replace(
    /<a[^>]*href="(https?:\/\/audio\.3speak\.tv\/play\?[^"]+)"[^>]*>.*?<\/a>/g,
    (match, fullUrl: string) => {
      let dedupeKey: string;
      try {
        const u = new URL(fullUrl.replace(/&amp;/gi, '&').replace(/^http:/i, 'https:'));
        dedupeKey = u.searchParams.get('a') || u.searchParams.get('cid') || u.toString();
      } catch {
        dedupeKey = fullUrl;
      }
      if (embeddedAudios.has(dedupeKey)) return match;
      embeddedAudios.add(dedupeKey);
      let embedUrl: string;
      try {
        const u = new URL(fullUrl.replace(/&amp;/gi, '&').replace(/^http:/i, 'https:'));
        u.searchParams.set('mode', 'compact');
        u.searchParams.set('iframe', '1');
        embedUrl = u.toString();
      } catch {
        embedUrl = fullUrl;
      }
      return `<div class="audio-container"><iframe src="${embedUrl}" loading="lazy" allow="autoplay; encrypted-media" allowtransparency="true"></iframe></div>`;
    }
  );

  content = content.replace(
    /<p>\s*(https?:\/\/audio\.3speak\.tv\/play\?[^<\s]+)\s*<\/p>/gi,
    (match, url: string) => {
      let dedupeKey: string;
      try {
        const u = new URL(url.replace(/^http:/i, 'https:'));
        dedupeKey = u.searchParams.get('a') || u.searchParams.get('cid') || u.toString();
      } catch {
        return match;
      }
      if (!dedupeKey || embeddedAudios.has(dedupeKey)) return match;
      embeddedAudios.add(dedupeKey);
      let embedUrl: string;
      try {
        const u = new URL(url.replace(/^http:/i, 'https:'));
        u.searchParams.set('mode', 'compact');
        u.searchParams.set('iframe', '1');
        embedUrl = u.toString();
      } catch {
        embedUrl = url;
      }
      return `<div class="audio-container"><iframe src="${embedUrl}" loading="lazy" allow="autoplay; encrypted-media" allowtransparency="true"></iframe></div>`;
    }
  );

  return content;
}

function transformTwitterContent(content: string): string {
  const embeddedTweets = new Set<string>();

  const twitterRegex = /<a[^>]*href="(https?:\/\/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)[^"]*)"[^>]*>.*?<\/a>/gi;
  content = content.replace(twitterRegex, (match, _fullUrl, _username, tweetId) => {
    if (embeddedTweets.has(tweetId)) return match;
    embeddedTweets.add(tweetId);
    return `<div class="twitter-embed-container" style="max-width: 550px;"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true" width="550" height="250" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy" style="border: 1px solid #ccc; border-radius: 12px;"></iframe></div>`;
  });

  const plainTwitterRegex = /(?<![">])(https?:\/\/(?:twitter\.com|x\.com)\/([^/\s]+)\/status\/(\d+))(?![^<]*<\/a>)/gi;
  content = content.replace(plainTwitterRegex, (match, _fullUrl, _username, tweetId) => {
    if (embeddedTweets.has(tweetId)) return match;
    embeddedTweets.add(tweetId);
    return `<div class="twitter-embed-container" style="max-width: 550px;"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true" width="550" height="250" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy" style="border: 1px solid #ccc; border-radius: 12px;"></iframe></div>`;
  });

  return content;
}

function transformInstagramContent(content: string): string {
  const embeddedPosts = new Set<string>();

  const instagramRegex = /<a[^>]*href="(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)[^"]*)"[^>]*>.*?<\/a>/gi;
  content = content.replace(instagramRegex, (match, _fullUrl, postCode) => {
    if (embeddedPosts.has(postCode)) return match;
    embeddedPosts.add(postCode);
    return `<div class="instagram-embed-container"><iframe src="https://www.instagram.com/p/${postCode}/embed" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy"></iframe></div>`;
  });

  const plainInstagramRegex = /(?<![">])(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)[^\s<]*)(?![^<]*<\/a>)/gi;
  content = content.replace(plainInstagramRegex, (match, _fullUrl, postCode) => {
    if (embeddedPosts.has(postCode)) return match;
    embeddedPosts.add(postCode);
    return `<div class="instagram-embed-container"><iframe src="https://www.instagram.com/p/${postCode}/embed" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy"></iframe></div>`;
  });

  return content;
}

function transformIPFSContent(content: string, ipfsGateway: string, fallbackGateways: string[]): string {
  const genericIframeRegex = /<iframe[^>]*\ssrc="https?:\/\/[^"]+\/ipfs\/([a-zA-Z0-9\-_.?=&]+)"[^>]*>[\s\S]*?<\/iframe>/gi;
  return content.replace(genericIframeRegex, (_match, videoID) => {
    const sources = [ipfsGateway, ...fallbackGateways]
      .map(gw => `<source src="${gw}/ipfs/${videoID}" type="video/mp4">`)
      .join('\n                    ');
    return `<video controls muted preload="none" loading="lazy">\n                    ${sources}\n                </video>`;
  });
}

function preventIPFSDownloads(content: string): string {
  return content.replace(
    /<a href="(https?:\/\/[^"]*(?:ipfs|bafy|Qm)[^"]*)"([^>]*)>/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer"$2>'
  );
}

function convertHiveUrlsToInternal(content: string, hiveFrontends: string[], internalPrefix: string): string {
  const frontendsPattern = hiveFrontends.map(domain => domain.replace('.', '\\.')).join('|');
  const hiveUrlRegex = new RegExp(
    `<a href="https?:\\/\\/(?:www\\.)?(${frontendsPattern})\\/((?:[^/]+\\/)?@([a-z0-9.-]+)\\/([a-z0-9-]+))"([^>]*)>`,
    'gi'
  );
  return content.replace(hiveUrlRegex, (_match, _frontend, _fullPath, author, permlink, attributes) => {
    const internalUrl = `${internalPrefix}/@${author}/${permlink}`;
    return `<a href="${internalUrl}"${attributes}>`;
  });
}

export function createSnapieHiveRenderer(options: SnapieHiveRendererOptions = {}) {
  const {
    baseUrl = 'https://hive.blog/',
    ipfsGateway = DEFAULT_IPFS_GATEWAY,
    ipfsFallbackGateways = DEFAULT_IPFS_FALLBACKS,
    usertagUrlFn = (account: string) => '/@' + account,
    hashtagUrlFn = (hashtag: string) => '/trending/' + hashtag,
    additionalHiveFrontends = [],
    convertHiveUrls = true,
    internalUrlPrefix = '',
    assetsWidth = 540,
    assetsHeight = 380,
    imageProxyFn,
  } = options;

  const hiveFrontends = [...DEFAULT_HIVE_FRONTENDS, ...additionalHiveFrontends];

  const defaultImageProxy = (url: string) => {
    try {
      if (url.includes('ipfs')) {
        const parts = url.split('/ipfs/');
        if (parts[1]) return `https://ipfs.io/ipfs/${parts[1]}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const renderer = new DefaultRenderer({
    baseUrl,
    breaks: true,
    skipSanitization: true,
    allowInsecureScriptTags: false,
    addNofollowToLinks: true,
    doNotShowImages: false,
    assetsWidth,
    assetsHeight,
    imageProxyFn: imageProxyFn || defaultImageProxy,
    usertagUrlFn,
    hashtagUrlFn,
    isLinkSafeFn: () => true,
    addExternalCssClassToMatchingLinksFn: () => true,
    ipfsPrefix: ipfsGateway,
  });

  return function renderHiveMarkdown(markdown: string): string {
    let html = renderer.render(markdown);
    html = transform3SpeakContent(html);
    html = transformIPFSContent(html, ipfsGateway, ipfsFallbackGateways);
    html = transformTwitterContent(html);
    html = transformInstagramContent(html);
    html = preventIPFSDownloads(html);
    if (convertHiveUrls) {
      html = convertHiveUrlsToInternal(html, hiveFrontends, internalUrlPrefix);
    }
    return sanitize(html);
  };
}

export const renderSnapieHiveMarkdown = createSnapieHiveRenderer();
