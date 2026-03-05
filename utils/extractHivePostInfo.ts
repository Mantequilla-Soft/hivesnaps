/**
 * Utility for extracting and fetching Hive post information from URLs
 * Supports ecency.com, peakd.com, and hive.blog post links
 */

import { getClient } from '../services/HiveClient';
import { detectPostType, type PostInfo } from './postTypeDetector';
import { avatarService, type AvatarLoadResult } from '../services/AvatarService';

// Constants for validation
const MIN_USERNAME_LENGTH = 3;
const MIN_PERMLINK_LENGTH = 3;

/**
 * URL classification types for Hive frontend links
 */
export type HiveUrlType = 'profile' | 'ui-page' | 'blog-post';

/**
 * Known UI page suffixes that are not blog posts
 * These represent profile pages and interface elements
 */
const UI_PAGE_SUFFIXES = [
  'wallet',
  'posts',
  'comments',
  'replies',
  'activities',
  'followers',
  'following',
  'notifications',
  'witnesses',
  'proposals',
  'settings',
  'blog',
  'feed'
] as const;

/**
 * Supported Hive frontend domains
 */
const HIVE_DOMAINS = ['ecency.com', 'peakd.com', 'hive.blog', 'snapie.io', 'www.snapie.io'] as const;

type HiveDomain = typeof HIVE_DOMAINS[number];

const client = getClient();


export interface HivePostInfo {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  voteCount: number;
  replyCount: number;
  payout: number;
  avatarUrl?: string;
  imageUrl?: string;
  summary: string;
  originalUrl: string;
  category?: string;
  tags: string[];
}

/**
 * Type guard to check if a string is a valid UI page suffix
 */
function isUIPageSuffix(suffix: string): suffix is typeof UI_PAGE_SUFFIXES[number] {
  return UI_PAGE_SUFFIXES.includes(suffix as typeof UI_PAGE_SUFFIXES[number]);
}

/**
 * Classifies a Hive URL into its type for proper handling
 * @param url - The URL to classify
 * @returns The URL type or null if not a valid Hive URL
 * 
 * @example
 * ```typescript
 * classifyHiveUrl('https://peakd.com/@username') // 'profile'
 * classifyHiveUrl('https://peakd.com/@username/wallet') // 'ui-page'
 * classifyHiveUrl('https://peakd.com/@username/my-post-title') // 'blog-post'
 * classifyHiveUrl('https://peakd.com/hive-123/@username/post') // 'blog-post'
 * ```
 */
export function classifyHiveUrl(url: string): HiveUrlType | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Normalize URL by removing protocol and www
    const cleanUrl = url.replace(/^https?:\/\/(?:www\.)?/, '').toLowerCase();

    // Check if it's a valid Hive domain
    const domain = cleanUrl.split('/')[0] as HiveDomain;
    if (!HIVE_DOMAINS.includes(domain)) {
      return null;
    }

    // Extract path components
    const pathParts = cleanUrl.split('/').slice(1);
    if (pathParts.length === 0) {
      return null;
    }

    // Handle different URL patterns
    const [firstPart, secondPart] = pathParts;

    // Pattern: @username (profile page)
    if (firstPart?.startsWith('@') && pathParts.length === 1) {
      return 'profile';
    }

    // Pattern: @username/something
    if (firstPart?.startsWith('@') && pathParts.length === 2) {
      const suffix = secondPart;
      return isUIPageSuffix(suffix) ? 'ui-page' : 'blog-post';
    }

    // Pattern: community/@username/something (always blog post)
    if (pathParts.length === 3 && secondPart?.startsWith('@')) {
      return 'blog-post';
    }

    // Pattern: hive-123/@username/something (always blog post)
    if (firstPart?.startsWith('hive-') && secondPart?.startsWith('@') && pathParts.length === 3) {
      return 'blog-post';
    }

    // Default to null for unrecognized patterns
    return null;
  } catch (error) {
    console.warn('[classifyHiveUrl] Error classifying URL:', { url, error });
    return null;
  }
}

/**
 * Extracts only blog post URLs from text content
 * Filters out profile pages and UI pages to prevent extraction errors
 */
export function extractBlogPostUrls(text: string): string[] {
  const allUrls = extractHivePostUrls(text);
  return allUrls.filter(url => classifyHiveUrl(url) === 'blog-post');
}

/**
 * Extract Hive post URLs from text content
 * Matches various Hive frontend URL patterns
 */
export function extractHivePostUrls(text: string): string[] {
  const hivePostUrls: string[] = [];

  // Regex patterns for different Hive frontends
  const patterns = [
    // ecency.com patterns
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/([a-z0-9-]+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,

    // peakd.com patterns
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/([a-z0-9-]+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,

    // hive.blog patterns
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/([a-z0-9-]+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,

    // snapie.io patterns
    /(?:https?:\/\/)?(?:www\.)?snapie\.io\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?snapie\.io\/([a-z0-9-]+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullUrl = match[0].startsWith('http')
        ? match[0]
        : `https://${match[0]}`;
      if (!hivePostUrls.includes(fullUrl)) {
        hivePostUrls.push(fullUrl);
      }
    }
  });

  return hivePostUrls;
}

/**
 * Parse author and permlink from Hive post URL
 */
export function parseHivePostUrl(
  url: string
): { author: string; permlink: string } | null {
  try {
    console.log('[extractHivePostInfo] parseHivePostUrl called with:', url);

    // Remove protocol and www if present
    const cleanUrl = url.replace(/^https?:\/\/(?:www\.)?/, '');

    // Extract path part - updated to include snapie.io
    const pathMatch = cleanUrl.match(
      /^(?:ecency\.com|peakd\.com|hive\.blog|snapie\.io)\/(.+)$/
    );
    if (!pathMatch) {
      console.log(
        '[extractHivePostInfo] URL does not match expected domain pattern:',
        cleanUrl
      );
      return null;
    }

    const path = pathMatch[1];

    // Handle different URL formats
    let authorPermlinkMatch;

    // Format: @author/permlink or community/@author/permlink
    authorPermlinkMatch = path.match(
      /^(?:[a-z0-9-]+\/)?@([a-z0-9.-]{3,16})\/([a-z0-9-]+)$/
    );
    if (authorPermlinkMatch) {
      const author = authorPermlinkMatch[1];
      const permlink = authorPermlinkMatch[2];

      // Basic validation - permlink should be at least minimum length and contain valid characters
      if (permlink.length < MIN_PERMLINK_LENGTH) {
        console.log('[extractHivePostInfo] Rejecting too short permlink:', {
          permlink,
          length: permlink.length,
          url,
        });
        return null;
      }

      // Check if permlink contains only valid characters (letters, numbers, hyphens)
      // Allow consecutive hyphens but disallow leading/trailing hyphens
      // Examples of valid: "abc", "a-b", "a--b", "abc-123", "a-1-b-2"
      // Examples of invalid: "-abc", "abc-", "-a-", ""
      const validPermlinkPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i;
      if (!validPermlinkPattern.test(permlink)) {
        console.log(
          '[extractHivePostInfo] Rejecting invalid permlink format:',
          {
            permlink,
            url,
          }
        );
        return null;
      }

      console.log('[extractHivePostInfo] Successfully parsed URL:', {
        author,
        permlink,
        url,
      });
      return { author, permlink };
    }

    console.log(
      '[extractHivePostInfo] URL does not match author/permlink pattern:',
      path
    );
    return null;
  } catch (error) {
    console.error('[extractHivePostInfo] Error parsing Hive post URL:', error);
    return null;
  }
}

/**
 * Remove Hive post URLs from text content
 */
export function removeHivePostUrls(text: string): string {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
  ];

  let result = text;
  patterns.forEach(pattern => {
    result = result.replace(pattern, '').trim();
  });

  // Clean up extra whitespace and newlines
  return result.replace(/\n\s*\n/g, '\n').trim();
}

/**
 * Extract first image URL from markdown/HTML content
 */
function extractFirstImage(body: string): string | undefined {
  // Try markdown image syntax first
  const mdImageMatch = body.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
  if (mdImageMatch) {
    return mdImageMatch[1];
  }

  // Try HTML img tag
  const htmlImageMatch = body.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (htmlImageMatch) {
    return htmlImageMatch[1];
  }

  return undefined;
}

/**
 * Generate post summary from body content
 */
function generateSummary(body: string, maxLength = 150): string {
  // Remove markdown and HTML formatting
  let summary = body
    .replace(/!\[.*?\]\([^)]*\)/g, '') // Remove images
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/#{1,6}\s*/g, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // Convert links to text
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (summary.length <= maxLength) {
    return summary;
  }

  // Truncate at word boundary
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLength * 0.7
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
}

/**
 * Fetch author avatar URL via unified AvatarService (Ecency images service)
 */
async function fetchAuthorAvatar(author: string): Promise<string> {
  try {
    const result: AvatarLoadResult = await avatarService.getAvatarUrl(author);
    const url = result?.url || '';
    try {
      console.log(`[Avatar][Extract] ${author} -> ${url || 'EMPTY'} (source=${result?.source || 'unknown'}, cache=${result?.fromCache ? 'hit' : 'miss'})`);
    } catch { }
    return url;
  } catch (error) {
    console.warn('[extractHivePostInfo] AvatarService failed, falling back to Ecency images URL:', { author, error });
    const fallback = `https://images.ecency.com/u/${author}/avatar/original`;
    try { console.log(`[Avatar][Extract] ${author} -> ${fallback} (fallback)`); } catch { }
    return fallback;
  }
}

/**
 * Fetch complete Hive post information
 */
export async function fetchHivePostInfo(
  author: string,
  permlink: string,
  originalUrl: string
): Promise<HivePostInfo | null> {
  try {
    console.log('[extractHivePostInfo] fetchHivePostInfo called with:', {
      author,
      permlink,
      originalUrl,
    });

    // Validate parameters before making API call
    if (!author || !permlink || author.length < MIN_USERNAME_LENGTH || permlink.length < MIN_PERMLINK_LENGTH) {
      console.warn('[extractHivePostInfo] Invalid parameters:', {
        author,
        permlink,
      });
      return null;
    }

    // Fetch post content and author avatar in parallel (avatar via unified service)
    const [post, avatarUrl] = await Promise.all([
      client.database.call('get_content', [author, permlink]),
      fetchAuthorAvatar(author),
    ]);

    if (!post || !post.author) {
      console.warn('[extractHivePostInfo] Post not found:', author, permlink);
      return null;
    }

    // Calculate payout
    const payout = parseFloat(
      post.pending_payout_value
        ? post.pending_payout_value.replace(' HBD', '')
        : '0'
    );

    // Extract tags from metadata
    let tags: string[] = [];
    try {
      if (post.json_metadata) {
        const metadata = JSON.parse(post.json_metadata);
        tags = metadata.tags || [];
      }
    } catch (e) {
      // Invalid JSON metadata
    }

    // Get main category (first tag or parent category)
    const category = tags.length > 0 ? tags[0] : post.category || undefined;

    // Extract first image
    const imageUrl = extractFirstImage(post.body);

    // Generate summary
    const summary = generateSummary(post.body);

    // Smart title function - determines title based on post type
    const getSmartTitle = async (postData: any): Promise<string> => {
      // If it has a title, use it
      if (postData.title && postData.title.trim()) {
        return postData.title;
      }

      // Use post type detection logic for untitled posts
      const postInfo: PostInfo = {
        author: postData.author,
        permlink: postData.permlink,
        title: postData.title,
        body: postData.body,
        json_metadata: postData.json_metadata,
        parent_author: postData.parent_author,
        parent_permlink: postData.parent_permlink,
      };

      const postType = await detectPostType(postInfo);

      // Return appropriate label based on type
      if (postType === 'snap') return 'Resnap';
      // If it's a reply (has parent_author) but no title, label clearly
      if (postData.parent_author && postData.parent_author.length > 0) {
        return 'Reply to Post';
      }
      return 'Untitled Post';
    };

    return {
      author: post.author,
      permlink: post.permlink,
      title: await getSmartTitle(post),
      body: post.body,
      created: post.created,
      voteCount: post.net_votes || 0,
      replyCount: post.children || 0,
      payout,
      avatarUrl,
      imageUrl,
      summary,
      originalUrl,
      category,
      tags: tags.slice(0, 5), // Limit to first 5 tags
    };
  } catch (error) {
    console.error('[extractHivePostInfo] Error fetching Hive post info:', {
      error,
      author,
      permlink,
      originalUrl,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    // Specific warning for "Invalid parameters" - likely malformed URL
    if (
      error instanceof Error &&
      error.message.includes('Invalid parameters')
    ) {
      console.warn(
        '[extractHivePostInfo] Invalid parameters detected - likely malformed URL or non-existent post:',
        {
          author,
          permlink,
          originalUrl,
        }
      );
    }

    return null;
  }
}

/**
 * Batch fetch multiple Hive post infos
 */
export async function fetchMultipleHivePostInfos(
  urls: string[]
): Promise<HivePostInfo[]> {
  console.log('[extractHivePostInfo] fetchMultipleHivePostInfos called with:', {
    urlsCount: urls.length,
    urls: urls.slice(0, 3), // Log first 3 URLs for debugging
  });

  const results = await Promise.allSettled(
    urls.map(async url => {
      try {
        const parsed = parseHivePostUrl(url);
        if (!parsed) {
          console.log('[extractHivePostInfo] Failed to parse URL:', url);
          return null;
        }

        return await fetchHivePostInfo(parsed.author, parsed.permlink, url);
      } catch (error) {
        console.error(
          '[extractHivePostInfo] Error processing URL:',
          url,
          error
        );
        return null;
      }
    })
  );

  const validResults = results
    .filter(
      (result): result is PromiseFulfilledResult<HivePostInfo | null> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value!);

  console.log('[extractHivePostInfo] fetchMultipleHivePostInfos completed:', {
    totalUrls: urls.length,
    validResults: validResults.length,
  });

  return validResults;
}

/**
 * Check if a URL is a snap URL by detecting the post type
 */
export async function isSnapUrl(url: string): Promise<boolean> {
  try {
    console.log('[extractHivePostInfo] Checking if URL is a snap:', url);

    // Parse the URL to get author and permlink
    const postInfo = parseHivePostUrl(url);
    if (!postInfo) {
      console.log('[extractHivePostInfo] Could not parse URL as Hive post');
      return false;
    }

    // Use statically imported detectPostType
    const postType = await detectPostType({
      author: postInfo.author,
      permlink: postInfo.permlink,
    });

    const isSnap = postType === 'snap';
    console.log(
      '[extractHivePostInfo] URL post type:',
      postType,
      'isSnap:',
      isSnap
    );

    return isSnap;
  } catch (error) {
    console.error(
      '[extractHivePostInfo] Error checking if URL is snap:',
      error
    );
    return false;
  }
}

/**
 * Get navigation info for a Hive post URL
 * Uses more restrictive detection for navigation to avoid misclassifying regular posts as snaps
 */
export async function getHivePostNavigationInfo(url: string): Promise<{
  isSnap: boolean;
  author: string;
  permlink: string;
  route: string;
} | null> {
  try {
    console.log('[extractHivePostInfo] Getting navigation info for URL:', url);

    // Parse the URL to get author and permlink
    const postInfo = parseHivePostUrl(url);
    if (!postInfo) {
      console.log('[extractHivePostInfo] Could not parse URL as Hive post');
      return null;
    }

    // Use statically imported detectPostType
    const postType = await detectPostType({
      author: postInfo.author,
      permlink: postInfo.permlink,
    });

    const isSnap = postType === 'snap';
    const route = isSnap ? '/ConversationScreen' : '/HivePostScreen';

    console.log('[extractHivePostInfo] Navigation info:', {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    });

    return {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    };
  } catch (error) {
    console.error('[extractHivePostInfo] Error getting navigation info:', error);
    return null;
  }
}

/**
 * Get navigation info for Hive post previews (more inclusive)
 * This allows external Hive posts to be navigated to HivePostScreen
 */
export async function getHivePostPreviewNavigationInfo(url: string): Promise<{
  isSnap: boolean;
  author: string;
  permlink: string;
  route: string;
} | null> {
  try {
    console.log(
      '[extractHivePostInfo] Getting preview navigation info for URL:',
      url
    );

    // Parse the URL to get author and permlink
    const postInfo = parseHivePostUrl(url);
    if (!postInfo) {
      console.log('[extractHivePostInfo] Could not parse URL as Hive post');
      return null;
    }

    // Use a more conservative approach for preview navigation
    // Only treat as snap if it has very clear snap indicators
    let isSnap = false;

    // Check for explicit snap permlink pattern
    if (postInfo.permlink.startsWith('snap-') || postInfo.permlink.startsWith('re-')) {
      isSnap = true;
      console.log('[extractHivePostInfo] Detected snap by permlink pattern');
    } else {
      // For other posts, use a lightweight check without the full detectPostType logic
      // Use statically imported Client from @hiveio/dhive
      // const { Client } = await import('@hiveio/dhive');
      // const client = new Client([...]);
      try {
        // Get the post data to check for snap indicators
        const post = await client.database.call('get_content', [
          postInfo.author,
          postInfo.permlink,
        ]);

        if (post) {
          // Check for snap indicators without using the full detectPostType logic
          const snapIndicators = [];

          // Check for snap permlink
          if (post.permlink && post.permlink.startsWith('snap-')) {
            snapIndicators.push('snap_permlink');
          }

          // Check for snap parent
          if (post.parent_author === 'peak.snaps') {
            snapIndicators.push('snap_parent');
          }

          // Check for snap metadata
          if (post.json_metadata) {
            try {
              const metadata = JSON.parse(post.json_metadata);
              if (metadata.app && metadata.app.includes('hivesnaps')) {
                snapIndicators.push('hivesnaps_app');
              }
              if (
                metadata.tags &&
                Array.isArray(metadata.tags) &&
                metadata.tags.includes('hivesnaps')
              ) {
                snapIndicators.push('hivesnaps_tag');
              }
            } catch (e) {
              // Invalid JSON, ignore
            }
          }

          // Check for snap-like content characteristics
          if (
            post.body &&
            post.body.length < 500 &&
            (!post.title || post.title.trim().length === 0)
          ) {
            snapIndicators.push('snap_characteristics');
          }

          console.log(
            '[extractHivePostInfo] Snap indicators found:',
            snapIndicators
          );

          // Require at least 2 clear snap indicators to treat as snap
          isSnap = snapIndicators.length >= 2;
        }
      } catch (error) {
        console.log(
          '[extractHivePostInfo] Error fetching post data, defaulting to HivePostScreen:',
          error
        );
        isSnap = false;
      }
    }

    const route = isSnap ? '/screens/ConversationScreen' : '/screens/HivePostScreen';

    console.log('[extractHivePostInfo] Preview navigation info:', {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    });

    return {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    };
  } catch (error) {
    console.error(
      '[extractHivePostInfo] Error getting preview navigation info:',
      error
    );
    return null;
  }
}
