import { extractImageUrls } from './extractImageUrls';
import {
  extractVideoInfo,
  removeVideoUrls,
  removeTwitterUrls,
  removeEmbedUrls,
} from './extractVideoInfo';
import { extractBlogPostUrls } from './extractHivePostInfo';
import { convertSpoilerSyntax } from './spoilerParser';

/**
 * Strips image tags from text content
 */
export const stripImageTags = (text: string): string => {
  return text.replace(/!\[.*?\]\(.*?\)/g, '').replace(/<img.*?>/g, '');
};

/**
 * Strips HTML tags from text content (e.g. 3Speak's auto-generated
 * <center><div>...</div></center> caption wrapper)
 */
export const stripHtmlTags = (text: string): string => {
  return text.replace(/<[^>]+>/g, ' ');
};

/**
 * Decodes/strips common HTML entities (e.g. &emsp;, &nbsp;) from text content
 */
export const stripHtmlEntities = (text: string): string => {
  return text.replace(/&[a-z]+;|&#\d+;/gi, ' ');
};

/**
 * Preserves paragraph spacing in markdown content
 */
export const preserveParagraphSpacing = (text: string): string => {
  return text.replace(/\n\n/g, '\n&nbsp;\n');
};

/**
 * Linkifies URLs in text content
 */
export const linkifyUrls = (text: string): string => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '[$1]($1)');
};

/**
 * Linkifies mentions (@username) in text content
 */
export const linkifyMentions = (text: string): string => {
  const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
  return text.replace(mentionRegex, '[@$1](https://peakd.com/@$1)');
};

/**
 * Linkifies hashtags (#tag) in text content
 * Supports hyphens within hashtags: #react-native, #covid-19, etc.
 */
export const linkifyHashtags = (text: string): string => {
  // Only match hashtags that are NOT part of URLs (not preceded by /)
  // Pattern: #word(s) optionally followed by -word(s) (prevents starting/ending with -)
  const hashtagRegex = /(^|[^\/\w])#([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/g;
  return text.replace(hashtagRegex, '$1[#$2](https://peakd.com/trending/$2)');
};

/**
 * Checks if a string contains HTML content
 */
export const containsHtml = (str: string): boolean => {
  const htmlRegex = /<[^>]*>/;
  return htmlRegex.test(str);
};

/**
 * Processes content body by applying all necessary transformations
 */
export const processContent = (body: string) => {
  const videoInfo = extractVideoInfo(body);
  const imageUrls = extractImageUrls(body);
  const hivePostUrls = extractBlogPostUrls(body);

  let textBody = body;

  // Remove video and embed URLs if present
  if (videoInfo || hivePostUrls.length > 0) {
    textBody = removeEmbedUrls(textBody);
  }

  // Strip image tags
  textBody = stripImageTags(textBody);

  // Process spoiler syntax
  const spoilerData = convertSpoilerSyntax(textBody);
  textBody = spoilerData.processedText;

  // Apply text transformations
  textBody = preserveParagraphSpacing(textBody);
  textBody = linkifyUrls(textBody);
  textBody = linkifyMentions(textBody);
  textBody = linkifyHashtags(textBody);

  return {
    textBody,
    videoInfo,
    imageUrls,
    hivePostUrls,
    spoilerData,
    isHtml: containsHtml(textBody),
  };
};
