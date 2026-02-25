import { Client } from '@hiveio/dhive';

// Create client instance (or import from your existing setup)
const client = new Client(['https://api.hive.blog', 'https://api.hivekings.com']);

/**
 * Fetches posts/comments by a specific user and filters for HiveSnaps
 * (posts where parent_author is 'peak.snaps')
 */
export async function getUserSnaps(
  username: string,
  sort: 'posts' | 'comments' = 'comments',
  limit: number = 10,
  start_author?: string,
  start_permlink?: string
): Promise<any[]> {
  try {
    // Build parameters for the Hive API call
    const params: any = {
      account: username,
      sort: sort,
      limit: limit
    };

    // Add pagination parameters if provided
    if (start_author && start_permlink) {
      params.start_author = start_author;
      params.start_permlink = start_permlink;
    }

    console.log(`[getUserSnaps] Fetching for ${username}, limit: ${limit}`);

    // Fetch user's posts/comments from Hive blockchain using dhive
    const posts = await client.call('bridge', 'get_account_posts', params);

    if (!posts || !Array.isArray(posts)) {
      console.log(`[getUserSnaps] No posts returned for ${username}`);
      return [];
    }

    // Filter for HiveSnaps only (parent_author must be 'peak.snaps')
    const snaps = posts.filter((post) => {
      return post.parent_author === 'peak.snaps';
    });

    console.log(`[getUserSnaps] Found ${snaps.length} snaps out of ${posts.length} total posts for ${username}`);

    return snaps;
  } catch (error) {
    console.error(`[getUserSnaps] Error fetching snaps for ${username}:`, error);
    throw error;
  }
}
