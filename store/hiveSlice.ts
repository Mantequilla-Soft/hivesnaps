/**
 * Hive Slice - Manages Hive blockchain data including posts, tags, and global data
 * Includes caching with expiration and efficient selectors
 */

import { HiveState, HiveAction, HivePost, HiveData, CacheItem, CACHE_DURATIONS } from './types';

// Helper to create cache items with expiration
function createCacheItem<T>(data: T, duration: number): CacheItem<T> {
  const timestamp = Date.now();
  return {
    data,
    timestamp,
    expiresAt: timestamp + duration,
  };
}

// Helper to check if cache item is expired
function isCacheExpired<T>(item: CacheItem<T>): boolean {
  return Date.now() > item.expiresAt;
}

// Initial state
export const initialHiveState: HiveState = {
  data: {
    medianPrice: null,
    globalProps: null,
    rewardFund: null,
    lastUpdated: 0,
  },
  posts: {},
  postsByTag: {},
  loading: {
    data: false,
    posts: {},
    tags: {},
  },
  errors: {
    data: null,
    posts: {},
    tags: {},
  },
};

// Hive reducer
export function hiveReducer(state: HiveState, action: HiveAction): HiveState {
  switch (action.type) {
    case 'HIVE_SET_DATA':
      return {
        ...state,
        data: {
          ...state.data,
          ...action.payload,
          lastUpdated: Date.now(),
        },
        errors: {
          ...state.errors,
          data: null,
        },
      };

    case 'HIVE_SET_POST':
      return {
        ...state,
        posts: {
          ...state.posts,
          [action.payload.key]: createCacheItem(
            action.payload.post,
            CACHE_DURATIONS.HIVE_POSTS
          ),
        },
        errors: {
          ...state.errors,
          posts: {
            ...state.errors.posts,
            [action.payload.key]: null,
          },
        },
      };

    case 'HIVE_SET_POSTS_BY_TAG':
      return {
        ...state,
        postsByTag: {
          ...state.postsByTag,
          [action.payload.tag]: createCacheItem(
            action.payload.postKeys,
            CACHE_DURATIONS.HIVE_POSTS
          ),
        },
        errors: {
          ...state.errors,
          tags: {
            ...state.errors.tags,
            [action.payload.tag]: null,
          },
        },
      };

    case 'HIVE_SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.type]: typeof action.payload.key === 'string' 
            ? {
                ...(state.loading[action.payload.type] as Record<string, boolean>),
                [action.payload.key]: action.payload.loading,
              }
            : action.payload.loading,
        },
      };

    case 'HIVE_SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.type]: typeof action.payload.key === 'string'
            ? {
                ...(state.errors[action.payload.type] as Record<string, string | null>),
                [action.payload.key]: action.payload.error,
              }
            : action.payload.error,
        },
      };

    case 'HIVE_CLEAR_CACHE':
      if (action.payload?.key && action.payload?.type && action.payload.type !== 'data') {
        // Clear specific cache
        const newState = { ...state };
        if (action.payload.type === 'posts') {
          delete newState.posts[action.payload.key];
        } else if (action.payload.type === 'tags') {
          delete newState.postsByTag[action.payload.key];
        }
        return newState;
      } else if (action.payload?.type) {
        // Clear all cache for specific type
        const newState = { ...state };
        if (action.payload.type === 'posts') {
          newState.posts = {};
        } else if (action.payload.type === 'tags') {
          newState.postsByTag = {};
        }
        return newState;
      } else {
        // Clear all cache
        return {
          ...state,
          posts: {},
          postsByTag: {},
        };
      }

    default:
      return state;
  }
}

// Selectors
export const hiveSelectors = {
  // Get global hive data
  getHiveData: (state: HiveState): HiveData => state.data,

  // Check if hive data needs refresh
  needsHiveDataRefresh: (state: HiveState): boolean => {
    return Date.now() - state.data.lastUpdated > CACHE_DURATIONS.HIVE_DATA;
  },

  // Get post with cache check
  getPost: (state: HiveState, author: string, permlink: string): HivePost | null => {
    const key = `${author}/${permlink}`;
    const cached = state.posts[key];
    if (!cached || isCacheExpired(cached)) {
      return null;
    }
    return cached.data;
  },

  // Get posts by tag with cache check
  getPostsByTag: (state: HiveState, tag: string): string[] | null => {
    const cached = state.postsByTag[tag];
    if (!cached || isCacheExpired(cached)) {
      return null;
    }
    return cached.data;
  },

  // Get loading state
  isLoading: (state: HiveState, type: keyof HiveState['loading'], key?: string): boolean => {
    if (type === 'data') {
      return state.loading.data;
    }
    if (!key) return false;
    return (state.loading[type] as Record<string, boolean>)[key] || false;
  },

  // Get error state
  getError: (state: HiveState, type: keyof HiveState['errors'], key?: string): string | null => {
    if (type === 'data') {
      return state.errors.data;
    }
    if (!key) return null;
    return (state.errors[type] as Record<string, string | null>)[key] || null;
  },

  // Check if post needs refresh
  needsPostRefresh: (state: HiveState, author: string, permlink: string): boolean => {
    const key = `${author}/${permlink}`;
    const cached = state.posts[key];
    return !cached || isCacheExpired(cached);
  },

  // Check if tag posts need refresh
  needsTagRefresh: (state: HiveState, tag: string): boolean => {
    const cached = state.postsByTag[tag];
    return !cached || isCacheExpired(cached);
  },

  // Get all cached posts
  getAllCachedPosts: (state: HiveState): HivePost[] => {
    return Object.values(state.posts)
      .filter(cached => !isCacheExpired(cached))
      .map(cached => cached.data);
  },

  // Get posts by author from cache
  getPostsByAuthor: (state: HiveState, author: string): HivePost[] => {
    return Object.values(state.posts)
      .filter(cached => !isCacheExpired(cached) && cached.data.author === author)
      .map(cached => cached.data);
  },

  // Get cache info for debugging
  getCacheInfo: (state: HiveState) => ({
    posts: Object.keys(state.posts).length,
    postsByTag: Object.keys(state.postsByTag).length,
    expiredPosts: Object.values(state.posts).filter(isCacheExpired).length,
    expiredTags: Object.values(state.postsByTag).filter(isCacheExpired).length,
    hiveDataAge: Date.now() - state.data.lastUpdated,
    hiveDataExpired: hiveSelectors.needsHiveDataRefresh(state),
  }),
};
