import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface AvatarCacheEntry {
  url: string;
  timestamp: number;
  source: 'metadata' | 'ecency-images' | 'fallback';
}

interface AvatarLoadResult {
  url: string;
  fromCache: boolean;
  source: 'metadata' | 'ecency-images' | 'fallback';
}

class AvatarService {
  private static instance: AvatarService;
  private cache = new Map<string, AvatarCacheEntry>();
  private loadingPromises = new Map<string, Promise<string>>();
  private listeners = new Set<(username: string, avatarUrl: string) => void>();
  private readonly DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

  // Cache duration: 30 minutes for successful loads, 5 minutes for failures
  private readonly CACHE_DURATION_SUCCESS = 30 * 60 * 1000;
  private readonly CACHE_DURATION_FAILURE = 5 * 60 * 1000;
  private readonly STORAGE_KEY = 'hivesnaps_unified_avatar_cache';

  private constructor() {
    // Only attempt to load from storage on native platforms
    // Web environment does not support AsyncStorage
    if (Platform.OS !== 'web') {
      this.loadCacheFromStorage().catch(error => {
        if (this.DEBUG) {
          console.warn('Failed to initialize avatar cache:', error);
        }
      });
    }
  }

  static getInstance(): AvatarService {
    if (!AvatarService.instance) {
      AvatarService.instance = new AvatarService();
    }
    return AvatarService.instance;
  }

  /**
   * Normalize usernames to a canonical cache key
   */
  private normalizeUsername(username: string | null | undefined): string {
    return (username || '').trim().toLowerCase();
  }

  /**
   * Deterministic Ecency images service URL for a username
   * Uses Ecency's reliable image proxy service instead of Hive's inconsistent service
   */
  static imagesAvatarUrl(username: string): string {
    const u = (username || '').trim().toLowerCase();
    const url = `https://images.ecency.com/u/${u}/avatar/original`;
    // Debug: Log URL construction to catch any /large issues
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[AvatarService] imagesAvatarUrl(${username}) -> ${url}`);
    }
    return url;
  }

  /**
   * Subscribe to avatar updates
   */
  subscribe(listener: (username: string, avatarUrl: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of avatar update
   */
  private notifyListeners(username: string, avatarUrl: string) {
    if (this.DEBUG) {
      try { console.log(`[Avatar][Service] notify ${username} -> ${avatarUrl || 'EMPTY'}`); } catch { }
    }
    this.listeners.forEach(listener => {
      try {
        listener(username, avatarUrl);
      } catch (error) {
        console.warn('Avatar listener error:', error);
      }
    });
  }

  /**
   * Get avatar URL for a user (with fallback strategies)
   */
  async getAvatarUrl(username: string): Promise<AvatarLoadResult> {
    const key = this.normalizeUsername(username);
    if (!key) {
      return { url: '', fromCache: false, source: 'fallback' };
    }

    // Check cache first
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached) {
      const cacheAge = now - cached.timestamp;
      const maxAge = cached.url ? this.CACHE_DURATION_SUCCESS : this.CACHE_DURATION_FAILURE;
      // Only short-circuit on non-empty cached URLs within TTL AND from images.ecency.com.
      // If the cached URL is from metadata or another host, treat as stale and re-fetch.
      const isImagesHost = typeof cached.url === 'string' && cached.url.startsWith('https://images.ecency.com/');
      if (cached.url && cacheAge < maxAge && isImagesHost) {
        return { url: cached.url, fromCache: true, source: 'ecency-images' };
      }
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(key);
    if (existingPromise) {
      const url = await existingPromise;
      return { url, fromCache: false, source: this.cache.get(key)?.source || 'ecency-images' };
    }

    // Start loading
    const loadPromise = this.fetchAvatarUrl(key);
    this.loadingPromises.set(key, loadPromise);

    try {
      const url = await loadPromise;
      this.loadingPromises.delete(key);

      // Notify listeners of the update
      this.notifyListeners(key, url);

      const result = { url, fromCache: false, source: this.cache.get(key)?.source || 'ecency-images' };
      if (this.DEBUG) {
        console.log(`[AvatarService] getAvatarUrl(${username}) -> ${url} (source: ${result.source})`);
      }
      return result;
    } catch (error) {
      this.loadingPromises.delete(key);
      console.warn(`Failed to load avatar for ${key}:`, error);
      return { url: '', fromCache: false, source: 'fallback' };
    }
  }

  /**
   * Preload avatars for multiple users
   */
  async preloadAvatars(usernames: string[]): Promise<void> {
    const uniqueUsernames = [...new Set(usernames.map(u => this.normalizeUsername(u)).filter(Boolean))];
    const loadPromises = uniqueUsernames.map(username =>
      this.getAvatarUrl(username).catch(() => ({ url: '', fromCache: false, source: 'fallback' as const }))
    );

    await Promise.all(loadPromises);
    if (this.DEBUG) {
      console.log(`✅ Preloaded avatars for ${uniqueUsernames.length} users`);
    }
  }

  /**
   * Get cached avatar URL immediately (no async loading)
   */
  getCachedAvatarUrl(username: string): string {
    const key = this.normalizeUsername(username);
    const cached = this.cache.get(key);
    if (!cached) {
      if (this.DEBUG) {
        console.log(`[AvatarService] getCachedAvatarUrl(${username}) -> NO CACHE`);
      }
      return '';
    }

    const now = Date.now();
    const cacheAge = now - cached.timestamp;
    const maxAge = cached.url ? this.CACHE_DURATION_SUCCESS : this.CACHE_DURATION_FAILURE;

    if (cacheAge >= maxAge) {
      if (this.DEBUG) {
        console.log(`[AvatarService] getCachedAvatarUrl(${username}) -> EXPIRED (age: ${Math.round(cacheAge / 1000)}s)`);
      }
      return '';
    }

    // Normalize: always prefer images.ecency.com with /original. Migrate any URL that's not exactly the right format.
    const imagesUrl = AvatarService.imagesAvatarUrl(key);
    if (!cached.url || cached.url !== imagesUrl) {
      if (this.DEBUG) {
        console.log(`[AvatarService] getCachedAvatarUrl(${username}) -> MIGRATING from ${cached.url} to ${imagesUrl}`);
      }
      this.cache.set(key, { url: imagesUrl, timestamp: Date.now(), source: 'ecency-images' });
      this.persistCacheToStorage();
      return imagesUrl;
    }

    if (this.DEBUG) {
      console.log(`[AvatarService] getCachedAvatarUrl(${username}) -> ${cached.url} (cached)`);
    }
    return cached.url;
  }

  /**
   * Force refresh avatar for a user
   */
  async refreshAvatar(username: string): Promise<string> {
    const key = this.normalizeUsername(username);
    this.cache.delete(key);
    this.loadingPromises.delete(key);
    const result = await this.getAvatarUrl(key);
    return result.url;
  }

  /**
   * Clear all cached avatars
   */
  clearCache(): void {
    if (this.DEBUG) {
      console.log(`[AvatarService] Clearing cache (${this.cache.size} entries)`);
    }
    this.cache.clear();
    this.loadingPromises.clear();
    AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Could be implemented with usage tracking
    };
  }

  /**
   * Actual avatar fetching with multiple strategies
   */
  private async fetchAvatarUrl(username: string): Promise<string> {
    let avatarUrl = '';
    let source: 'metadata' | 'ecency-images' | 'fallback' = 'ecency-images';

    // Always use the deterministic Ecency images service URL.
    // We intentionally avoid metadata because many accounts reference dead hosts (e.g., snag.gy).
    const ecencyImageUrl = AvatarService.imagesAvatarUrl(username);
    avatarUrl = ecencyImageUrl;
    source = 'ecency-images';

    // Cache the result (even if empty)
    this.cache.set(username, {
      url: avatarUrl,
      timestamp: Date.now(),
      source,
    });

    // Persist cache to storage periodically
    this.persistCacheToStorage();

    return avatarUrl;
  }

  /**
   * Load cache from AsyncStorage
   */
  private async loadCacheFromStorage(): Promise<void> {
    try {
      // Guard against web environment where AsyncStorage may not be available
      if (Platform.OS === 'web') {
        return;
      }
      const cacheData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        Object.entries(parsed).forEach(([username, entry]) => {
          const e = entry as AvatarCacheEntry;
          // Migrate any URLs that aren't exactly the correct Ecency /original format
          const correctUrl = AvatarService.imagesAvatarUrl(username);
          const normalized: AvatarCacheEntry = e.url === correctUrl
            ? e
            : {
              url: correctUrl,
              timestamp: Date.now(),
              source: 'ecency-images',
            };
          this.cache.set(this.normalizeUsername(username), normalized);
        });
        if (this.DEBUG) {
          console.log(`📱 Loaded ${this.cache.size} avatar cache entries from storage`);
        }
      }
    } catch (error) {
      console.warn('Failed to load avatar cache from storage:', error);
    }
  }

  /**
   * Persist cache to AsyncStorage (debounced)
   */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistCacheToStorage(): void {
    // Skip persistence on web environment
    if (Platform.OS === 'web') {
      return;
    }

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(async () => {
      try {
        const cacheObject = Object.fromEntries(this.cache.entries());
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheObject));
      } catch (error) {
        console.warn('Failed to persist avatar cache to storage:', error);
      }
    }, 1000); // Debounce by 1 second
  }
}

// Export singleton instance
export const avatarService = AvatarService.getInstance();

// Export standalone helper function for generating avatar URLs
export const getAvatarImageUrl = (username: string): string => {
  return AvatarService.imagesAvatarUrl(username);
};

export type { AvatarLoadResult };
