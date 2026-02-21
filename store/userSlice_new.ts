/**
 * User Slice - Manages user profiles, following lists, and followers
 * Includes caching with expiration and efficient selectors
 */

import { UserState, UserAction, UserProfile, CacheItem, CACHE_DURATIONS } from './types';

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
export const initialUserState: UserState = {
  currentUser: null,
  hasActiveKey: false,
  profiles: {},
  followingLists: {},
  followerLists: {},
  mutedLists: {},
  loading: {
    profile: {},
    following: {},
    followers: {},
    muted: {},
  },
  errors: {
    profile: {},
    following: {},
    followers: {},
    muted: {},
  },
};

// User reducer
export function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'USER_SET_CURRENT':
      return {
        ...state,
        currentUser: action.payload,
      };

    case 'USER_SET_HAS_ACTIVE_KEY':
      return {
        ...state,
        hasActiveKey: action.payload,
      };

    case 'USER_SET_PROFILE':
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [action.payload.username]: createCacheItem(
            action.payload.profile,
            CACHE_DURATIONS.USER_PROFILE
          ),
        },
        errors: {
          ...state.errors,
          profile: {
            ...state.errors.profile,
            [action.payload.username]: null,
          },
        },
      };

    case 'USER_SET_FOLLOWING_LIST':
      return {
        ...state,
        followingLists: {
          ...state.followingLists,
          [action.payload.username]: createCacheItem(
            action.payload.following,
            CACHE_DURATIONS.FOLLOWING_LIST
          ),
        },
        errors: {
          ...state.errors,
          following: {
            ...state.errors.following,
            [action.payload.username]: null,
          },
        },
      };

    case 'USER_SET_FOLLOWER_LIST':
      return {
        ...state,
        followerLists: {
          ...state.followerLists,
          [action.payload.username]: createCacheItem(
            action.payload.followers,
            CACHE_DURATIONS.FOLLOWING_LIST
          ),
        },
        errors: {
          ...state.errors,
          followers: {
            ...state.errors.followers,
            [action.payload.username]: null,
          },
        },
      };

    case 'USER_SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.type]: {
            ...state.loading[action.payload.type],
            [action.payload.username]: action.payload.loading,
          },
        },
      };

    case 'USER_SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.type]: {
            ...state.errors[action.payload.type],
            [action.payload.username]: action.payload.error,
          },
        },
      };

    case 'USER_CLEAR_CACHE':
      if (action.payload?.username && action.payload?.type) {
        // Clear specific cache
        const newState = { ...state };
        if (action.payload.type === 'profile') {
          delete newState.profiles[action.payload.username];
        } else if (action.payload.type === 'following') {
          delete newState.followingLists[action.payload.username];
        } else if (action.payload.type === 'followers') {
          delete newState.followerLists[action.payload.username];
        }
        return newState;
      } else if (action.payload?.username) {
        // Clear all cache for specific user
        const newState = { ...state };
        delete newState.profiles[action.payload.username];
        delete newState.followingLists[action.payload.username];
        delete newState.followerLists[action.payload.username];
        return newState;
      } else {
        // Clear all cache
        return {
          ...state,
          profiles: {},
          followingLists: {},
          followerLists: {},
        };
      }

    default:
      return state;
  }
}

// Selectors
export const userSelectors = {
  // Get current user
  getCurrentUser: (state: UserState): string | null => state.currentUser,

  // Get hasActiveKey
  getHasActiveKey: (state: UserState): boolean => state.hasActiveKey,

  // Get user profile with cache check
  getUserProfile: (state: UserState, username: string): UserProfile | null => {
    const cached = state.profiles[username];
    if (!cached || isCacheExpired(cached)) {
      return null;
    }
    return cached.data;
  },

  // Get following list with cache check
  getFollowingList: (state: UserState, username: string): string[] | null => {
    const cached = state.followingLists[username];
    if (!cached || isCacheExpired(cached)) {
      return null;
    }
    return cached.data;
  },

  // Get follower list with cache check
  getFollowerList: (state: UserState, username: string): string[] | null => {
    const cached = state.followerLists[username];
    if (!cached || isCacheExpired(cached)) {
      return null;
    }
    return cached.data;
  },

  // Check if user is following another user
  isFollowing: (state: UserState, follower: string, following: string): boolean | null => {
    const followingList = userSelectors.getFollowingList(state, follower);
    if (!followingList) return null;
    return followingList.includes(following);
  },

  // Get loading state
  isLoading: (state: UserState, type: keyof UserState['loading'], username: string): boolean => {
    return state.loading[type][username] || false;
  },

  // Get error state
  getError: (state: UserState, type: keyof UserState['errors'], username: string): string | null => {
    return state.errors[type][username] || null;
  },

  // Check if data needs refresh (cache expired or doesn't exist)
  needsRefresh: {
    profile: (state: UserState, username: string): boolean => {
      const cached = state.profiles[username];
      return !cached || isCacheExpired(cached);
    },
    following: (state: UserState, username: string): boolean => {
      const cached = state.followingLists[username];
      return !cached || isCacheExpired(cached);
    },
    followers: (state: UserState, username: string): boolean => {
      const cached = state.followerLists[username];
      return !cached || isCacheExpired(cached);
    },
  },

  // Get cache info for debugging
  getCacheInfo: (state: UserState) => ({
    profiles: Object.keys(state.profiles).length,
    followingLists: Object.keys(state.followingLists).length,
    followerLists: Object.keys(state.followerLists).length,
    expiredProfiles: Object.values(state.profiles).filter(isCacheExpired).length,
    expiredFollowing: Object.values(state.followingLists).filter(isCacheExpired).length,
    expiredFollowers: Object.values(state.followerLists).filter(isCacheExpired).length,
  }),
};
