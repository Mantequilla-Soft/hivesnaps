/**
 * Utility to detect post types (snap vs regular Hive post)
 */

import { getClient } from '../services/HiveClient';

export interface PostInfo {
  author: string;
  permlink: string;
  title?: string;
  body?: string;
  json_metadata?: string;
  parent_author?: string;
  parent_permlink?: string;
}

/**
 * Recursively check if any parent in the chain is a snap
 * This handles nested replies to snaps
 */
async function checkParentChainForSnap(
  author: string,
  permlink: string,
  depth = 0
): Promise<boolean> {
  // Prevent infinite recursion
  if (depth > 10) {
    console.log(
      '[postTypeDetector] Max recursion depth reached, stopping parent chain check'
    );
    return false;
  }

  console.log(`[postTypeDetector] Checking parent chain at depth ${depth}:`, {
    author,
    permlink,
  });

  try {
    const client = getClient();

    // Get the post data
    const post = await client.database.call('get_content', [author, permlink]);

    if (!post) {
      console.log(`[postTypeDetector] No post found at depth ${depth}`);
      return false;
    }

    console.log(`[postTypeDetector] Parent at depth ${depth}:`, {
      author: post.author,
      permlink: post.permlink,
      parent_author: post.parent_author,
      parent_permlink: post.parent_permlink,
    });

    // Check if this parent is a snap
    if (post.permlink && post.permlink.startsWith('snap-')) {
      console.log(
        `[postTypeDetector] ✅ Found snap in parent chain at depth ${depth}`
      );
      return true;
    }

    // If this parent has a parent, continue climbing
    if (post.parent_author && post.parent_permlink) {
      return await checkParentChainForSnap(
        post.parent_author,
        post.parent_permlink,
        depth + 1
      );
    }

    // No more parents to check
    console.log(
      `[postTypeDetector] Reached top of parent chain at depth ${depth}`
    );
    return false;
  } catch (error) {
    console.log(
      `[postTypeDetector] Error checking parent at depth ${depth}:`,
      error
    );
    return false;
  }
}

export type PostType = 'snap' | 'hive_post';

/**
 * Helper function to check if a post has strong snap indicators
 * Strong indicators are reliable signs that a post is definitely a snap
 */
function hasStrongSnapIndicators(post: any, metadata?: any): boolean {
  return (
    post.permlink?.startsWith('snap-') ||
    post.parent_author === 'peak.snaps' ||
    (metadata?.app && metadata.app.includes('hivesnaps'))
  );
}

/**
 * Detect if a post is a snap based on its metadata and content
 */
export async function detectPostType(post: PostInfo): Promise<PostType> {
  console.log('[postTypeDetector] ===== STARTING POST TYPE DETECTION =====');
  console.log('[postTypeDetector] Input post data:', {
    author: post.author,
    permlink: post.permlink,
    parent_author: post.parent_author,
    parent_permlink: post.parent_permlink,
    hasMetadata: !!post.json_metadata,
    hasBody: !!post.body,
    bodyLength: post.body?.length || 0,
  });

  // Check for invalid/short permlinks that are likely not real posts
  if (post.permlink && post.permlink.length < 5) {
    console.log(
      '[postTypeDetector] ❌ Very short permlink, likely invalid post'
    );
    return 'hive_post'; // Default to regular post for invalid ones
  }

  // PRIMARY SNAP DETECTION: Check if it's a snap based on permlink pattern
  // Snaps typically have permlinks that start with "snap-" followed by a timestamp
  // This is the most reliable indicator and works regardless of which frontend was used
  console.log('[postTypeDetector] 🔍 Checking permlink pattern...');
  console.log('[postTypeDetector]   - Permlink:', post.permlink);
  console.log(
    '[postTypeDetector]   - Starts with "snap-":',
    post.permlink?.startsWith('snap-')
  );

  if (post.permlink && post.permlink.startsWith('snap-')) {
    console.log('[postTypeDetector] ✅ Detected snap by permlink pattern');
    return 'snap';
  }

  // SECONDARY SNAP DETECTION: Check if it's a snap based on parent_author
  // Snaps are typically replies to a container post by 'peak.snaps'
  console.log('[postTypeDetector] 🔍 Checking parent_author...');
  console.log('[postTypeDetector]   - Parent author:', post.parent_author);
  console.log(
    '[postTypeDetector]   - Equals "peak.snaps":',
    post.parent_author === 'peak.snaps'
  );

  if (post.parent_author === 'peak.snaps') {
    console.log('[postTypeDetector] ✅ Detected snap by parent_author');
    return 'snap';
  }

  // TERTIARY SNAP DETECTION: Check if parent_permlink indicates this is a reply to a snap
  // This handles cases where someone replies to a snap from peakD or other frontends
  console.log('[postTypeDetector] 🔍 Checking parent_permlink...');
  console.log('[postTypeDetector]   - Parent permlink:', post.parent_permlink);
  console.log(
    '[postTypeDetector]   - Parent permlink starts with "snap-":',
    post.parent_permlink && post.parent_permlink.startsWith('snap-')
  );

  if (post.parent_permlink && post.parent_permlink.startsWith('snap-')) {
    console.log(
      '[postTypeDetector] ✅ Detected snap by parent_permlink (reply to snap)'
    );
    return 'snap';
  }

  // QUATERNARY SNAP DETECTION: Check parent chain recursively for snaps
  // This handles nested replies to snaps (replies to replies to snaps)
  if (post.parent_author && post.parent_permlink) {
    console.log('[postTypeDetector] 🔍 Checking parent chain recursively...');
    console.log('[postTypeDetector]   - Starting with parent:', {
      author: post.parent_author,
      permlink: post.parent_permlink,
    });

    const isInSnapChain = await checkParentChainForSnap(
      post.parent_author,
      post.parent_permlink
    );

    if (isInSnapChain) {
      console.log(
        '[postTypeDetector] ✅ Detected snap by parent chain (nested reply to snap)'
      );
      return 'snap';
    } else {
      console.log('[postTypeDetector] ❌ No snap found in parent chain');
    }
  }

  // QUINARY SNAP DETECTION: Check if it's a snap based on metadata
  console.log('[postTypeDetector] 🔍 Checking metadata...');
  console.log('[postTypeDetector]   - Has metadata:', !!post.json_metadata);

  if (post.json_metadata) {
    try {
      const metadata = JSON.parse(post.json_metadata);
      console.log('[postTypeDetector]   - Parsed metadata:', {
        app: metadata.app,
        tags: metadata.tags,
        tagsCount: metadata.tags?.length || 0,
        fullMetadata: metadata,
      });

      // Check for snap-specific metadata
      console.log('[postTypeDetector]   - Checking app field...');
      console.log('[postTypeDetector]     - App value:', metadata.app);
      console.log(
        '[postTypeDetector]     - App includes "hivesnaps":',
        metadata.app && metadata.app.includes('hivesnaps')
      );

      if (metadata.app && metadata.app.includes('hivesnaps')) {
        console.log('[postTypeDetector] ✅ Detected snap by app metadata');
        return 'snap';
      }

      // Check for snap-specific tags - be more specific
      console.log('[postTypeDetector]   - Checking tags...');
      console.log('[postTypeDetector]     - Tags array:', metadata.tags);
      console.log(
        '[postTypeDetector]     - Tags includes "hivesnaps":',
        metadata.tags &&
          Array.isArray(metadata.tags) &&
          metadata.tags.includes('hivesnaps')
      );

      if (metadata.tags && Array.isArray(metadata.tags)) {
        // Only detect as snap if it has the specific hivesnaps tag AND other snap indicators
        if (metadata.tags.includes('hivesnaps')) {
          // Additional check: only detect as snap if it also has other snap indicators
          // This prevents regular posts that happen to have 'hivesnaps' as a tag
          const hasOtherSnapIndicators =
            (metadata.app && metadata.app.includes('hivesnaps')) ||
            (post.permlink && post.permlink.startsWith('snap-')) ||
            post.parent_author === 'peak.snaps';

          console.log(
            '[postTypeDetector]     - Has other snap indicators:',
            hasOtherSnapIndicators
          );
          console.log(
            '[postTypeDetector]       - App includes hivesnaps:',
            metadata.app && metadata.app.includes('hivesnaps')
          );
          console.log(
            '[postTypeDetector]       - Permlink starts with snap-:',
            post.permlink && post.permlink.startsWith('snap-')
          );
          console.log(
            '[postTypeDetector]       - Parent author is peak.snaps:',
            post.parent_author === 'peak.snaps'
          );

          if (hasOtherSnapIndicators) {
            console.log(
              '[postTypeDetector] ✅ Detected snap by hivesnaps tag + other indicators'
            );
            return 'snap';
          } else {
            console.log(
              '[postTypeDetector] ⚠️ Has hivesnaps tag but no other snap indicators - treating as regular post'
            );
          }
        }
        // Don't detect as snap just because it has 'snap' in tags - that's too broad
        // Many regular posts might have 'snap' as a tag but aren't actually snaps
      }
    } catch (e) {
      console.log('[postTypeDetector] ❌ Invalid JSON metadata:', e);
      // Invalid JSON metadata, continue with other checks
    }
  } else {
    console.log('[postTypeDetector]   - No metadata available');
  }

  // ADDITIONAL DETECTION: Check for content length and format (snap-like characteristics)
  // This helps detect short-form content that might be snap-like even without app metadata
  console.log('[postTypeDetector] 🔍 Checking content characteristics...');
  if (post.body) {
    const bodyLength = post.body.length;
    const hasTitle = post.title && post.title.trim().length > 0;

    console.log('[postTypeDetector]   - Body length:', bodyLength);
    console.log('[postTypeDetector]   - Has title:', hasTitle);

    // If it's short content (under 500 chars) with no title or minimal title,
    // and not a reply (no parent), it's likely snap-like content
    if (
      bodyLength < 500 &&
      !hasTitle &&
      (!post.parent_author || post.parent_author === '')
    ) {
      console.log(
        '[postTypeDetector] ✅ Detected snap-like content by characteristics'
      );
      return 'snap';
    }
  }

  // SENARY SNAP DETECTION: Check if it's a snap based on content patterns
  console.log('[postTypeDetector] 🔍 Checking content patterns...');
  console.log('[postTypeDetector]   - Has body:', !!post.body);

  if (post.body) {
    const body = post.body.toLowerCase();
    console.log(
      '[postTypeDetector]   - Body preview (first 100 chars):',
      body.substring(0, 100)
    );
    console.log(
      '[postTypeDetector]   - Body includes "#hivesnaps":',
      body.includes('#hivesnaps')
    );

    // Look for snap-specific content patterns - be more specific
    if (body.includes('#hivesnaps')) {
      console.log('[postTypeDetector] ✅ Detected snap by #hivesnaps hashtag');
      return 'snap';
    }

    // Don't detect as snap just because it mentions 'snapie' or 'snap-' in content
    // This is too broad and catches regular posts that mention these words
    // Only detect if it has specific snap formatting or patterns
  } else {
    console.log('[postTypeDetector]   - No body content available');
  }

  // SEPTENARY DETECTION: Check for specific snap-like characteristics
  // Only treat as snap if it has clear snap-like characteristics
  // This prevents regular blog posts from being treated as snaps for navigation
  console.log(
    '[postTypeDetector] 🔍 Checking for snap-like characteristics...'
  );

  // Only treat as snap if it has multiple snap indicators
  const snapIndicators = [];

  // Check for short content
  if (post.body && post.body.length < 500) {
    snapIndicators.push('short_content');
  }

  // Check for no title
  if (!post.title || post.title.trim().length === 0) {
    snapIndicators.push('no_title');
  }

  // Check for no parent (not a reply)
  if (!post.parent_author || post.parent_author === '') {
    snapIndicators.push('no_parent');
  }

  // Check for snap-like permlink pattern
  if (post.permlink && post.permlink.startsWith('snap-')) {
    snapIndicators.push('snap_permlink');
  }

  // Check for snap-related metadata
  if (post.json_metadata) {
    try {
      const metadata = JSON.parse(post.json_metadata);
      if (metadata.app && metadata.app.includes('hivesnaps')) {
        snapIndicators.push('hivesnaps_app');
      }
      // Note: Don't use 'hivesnaps' tag alone as an indicator
      // Regular blog posts that mention HiveSnaps will have this tag
      // but aren't actual snaps. Only consider the tag if there are
      // other strong snap indicators already present.
      if (
        metadata.tags &&
        Array.isArray(metadata.tags) &&
        metadata.tags.includes('hivesnaps') &&
        hasStrongSnapIndicators(post, metadata)
      ) {
        snapIndicators.push('hivesnaps_tag');
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  console.log('[postTypeDetector]   - Snap indicators found:', snapIndicators);

  // Require at least 2 snap indicators to treat as snap for navigation
  // This prevents regular blog posts from being misclassified
  if (snapIndicators.length >= 2) {
    console.log(
      '[postTypeDetector] ✅ Detected as snap with multiple indicators'
    );
    return 'snap';
  }

  // Additional check: if parent_author is empty or null, it's likely a regular post
  console.log('[postTypeDetector] 🔍 Final checks...');
  console.log(
    '[postTypeDetector]   - Parent author is empty/null:',
    !post.parent_author || post.parent_author === ''
  );

  if (!post.parent_author || post.parent_author === '') {
    console.log('[postTypeDetector] ⚠️ No parent_author, likely regular post');
    // Continue with other checks, but this is a good indicator
  }

  console.log(
    '[postTypeDetector] ❌ All checks failed - defaulting to regular Hive post'
  );
  console.log('[postTypeDetector] ===== ENDING POST TYPE DETECTION =====');
  // Default to regular Hive post
  return 'hive_post';
}

/**
 * Get the appropriate screen route based on post type
 */
export async function getPostScreenRoute(post: PostInfo): Promise<string> {
  const postType = await detectPostType(post);
  // Return the appropriate route based on post type
  if (postType === 'snap') {
    return '/ConversationScreen';
  } else {
    return '/HivePostScreen';
  }
}

// Allows all hive posts to be resnapped, no special restrictions
export function canBeResnapped(post: PostInfo): boolean {
  // Any valid Hive post can be resnapped, regardless of its type
  return !!(post.author && post.permlink && post.permlink.length >= 5);
}
