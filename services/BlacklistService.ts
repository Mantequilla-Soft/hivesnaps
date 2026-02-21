import { makeAuthenticatedRequest } from './AuthenticatedRequest';

interface BlacklistApiResponse {
  data?: string[];
  blacklist?: string[];
  users?: string[];
  blacklistedUsers?: string[]; // The actual field name from your API
}

// Union type for all possible API response formats
type BlacklistResponseData = string[] | BlacklistApiResponse | null | undefined;

/**
 * Service for fetching the global blacklist of users from the HiveSnaps team's API.
 * Uses the networking layer with built-in caching for optimal performance.
 */
export class BlacklistService {

  /**
   * Get the global blacklist of users.
   * Uses networking layer caching for optimal performance.
   */
  static async getBlacklist(): Promise<string[]> {
    try {
      console.log('[BlacklistService] Fetching blacklist from /blacklisted');

      // Use authenticated request with built-in caching and JWT token
      // Note: Blacklist is public data, so we don't require authentication
      const response = await makeAuthenticatedRequest({
        path: '/blacklisted',
        method: 'GET',
        shouldCache: true, // Enable networking layer caching
        timeoutMs: 10000,
        retries: 2,
        requireAuth: false // Blacklist is public data
      });

      const blacklist = this.extractBlacklistFromResponse(response.body);

      if (blacklist.length > 0) {
        console.log('[BlacklistService] Successfully fetched blacklist:', blacklist.length, 'users');
        return blacklist;
      } else {
        console.warn('[BlacklistService] Empty blacklist received');
        return [];
      }
    } catch (error) {
      console.error('[BlacklistService] Failed to fetch blacklist:', error);
      // Return empty array as fallback to avoid breaking the app
      return [];
    }
  }

  /**
   * Extract blacklist array from various API response formats
   * @param data - The response data from the blacklist API
   * @returns Array of blacklisted usernames
   */
  private static extractBlacklistFromResponse(data: BlacklistResponseData): string[] {
    if (!data) {
      console.log('[BlacklistService] ❌ No data received');
      return [];
    }

    console.log('[BlacklistService] 🔍 Raw API response:', JSON.stringify(data, null, 2));

    // Handle different response formats
    if (Array.isArray(data)) {
      const filtered = data.filter(item => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found array format:', filtered.length, 'users');
      return filtered;
    }

    // Check for blacklistedUsers field (the actual field from your API)
    if (data.blacklistedUsers && Array.isArray(data.blacklistedUsers)) {
      const filtered = data.blacklistedUsers.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found blacklistedUsers field:', filtered.length, 'users');
      console.log('[BlacklistService] 📋 Blacklisted users:', filtered);
      return filtered;
    }

    if (data.data && Array.isArray(data.data)) {
      const filtered = data.data.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found data field:', filtered.length, 'users');
      return filtered;
    }

    if (data.blacklist && Array.isArray(data.blacklist)) {
      const filtered = data.blacklist.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found blacklist field:', filtered.length, 'users');
      return filtered;
    }

    if (data.users && Array.isArray(data.users)) {
      const filtered = data.users.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found users field:', filtered.length, 'users');
      return filtered;
    }

    console.warn('[BlacklistService] ❌ Unexpected response format:', data);
    return [];
  }
}
