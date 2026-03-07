import { useState, useCallback } from 'react';
import { hiveCallWithFailover } from '../services/HiveClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarService } from '../services/AvatarService';

export interface SearchResult {
  name: string;
  displayName?: string;
  about?: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
}

export type SearchType = 'content' | 'users';

interface SearchState {
  query: string;
  type: SearchType;
  results: { users: SearchResult[] };
  loading: boolean;
  recentSearches: string[];
  recentHashtags: string[];
}

interface UseSearchReturn extends SearchState {
  setQuery: (query: string) => void;
  setType: (type: SearchType) => void;
  search: (query?: string) => Promise<void>;
  clearResults: () => void;
  saveToRecentSearches: (query: string) => Promise<void>;
  saveToRecentHashtags: (hashtag: string) => Promise<void>;
  removeRecentSearch: (searchTerm: string) => Promise<void>;
  removeRecentHashtag: (hashtag: string) => Promise<void>;
  loadRecentSearches: () => Promise<void>;
}

export const useSearch = (): UseSearchReturn => {
  const [state, setState] = useState<SearchState>({
    query: '',
    type: 'users',
    results: { users: [] },
    loading: false,
    recentSearches: [],
    recentHashtags: [],
  });

  const searchUsers = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      try {
        // Search for users using Hive's lookup_accounts API
        const usernames = await hiveCallWithFailover(client => client.database.call('lookup_accounts', [
          query.toLowerCase(),
          10,
        ]));

        if (usernames.length === 0) return [];

        // Get account details for found usernames
        const accounts = await hiveCallWithFailover(client => client.database.getAccounts(usernames));

        // Use unified avatar service and deterministic URLs
        const usersWithAvatars = accounts.map(account => {
          const name = account.name;
          const immediate =
            avatarService.getCachedAvatarUrl(name) ||
            `https://images.hive.blog/u/${name}/avatar/original`;
          // Warm in background (fire-and-forget)
          avatarService.getAvatarUrl(name).catch(() => {});
          let displayName: string | undefined = undefined;
          let about: string | undefined = undefined;
          // Optionally parse display fields (safe)
          try {
            let meta: any = undefined;
            if (account.posting_json_metadata) meta = JSON.parse(account.posting_json_metadata);
            if ((!meta || !meta.profile) && account.json_metadata) meta = JSON.parse(account.json_metadata);
            displayName = meta?.profile?.name || account.name;
            about = meta?.profile?.about || '';
          } catch {}
          return {
            name,
            displayName: displayName || account.name,
            about: about || '',
            avatarUrl: immediate,
            followerCount: 0,
            followingCount: 0,
          } as SearchResult;
        });

        return usersWithAvatars;
      } catch (err) {
        console.log('Error searching users:', err);
        return [];
      }
    },
    []
  );

  const search = useCallback(
    async (query?: string) => {
      const searchTerm = query || state.query;
      if (!searchTerm.trim()) {
        setState(prev => ({ ...prev, results: { users: [] } }));
        return;
      }

      if (state.type === 'content') {
        // Content search is handled by navigation to DiscoveryScreen
        // This hook just manages the query state
        return;
      }

      if (state.type === 'users') {
        setState(prev => ({ ...prev, loading: true }));
        try {
          const users = await searchUsers(searchTerm);
          setState(prev => ({
            ...prev,
            results: { users },
            loading: false,
          }));

          // Save to recent searches
          await saveToRecentSearches(searchTerm);
        } catch (err) {
          console.log('Search error:', err);
          setState(prev => ({
            ...prev,
            results: { users: [] },
            loading: false,
          }));
        }
      }
    },
    [state.query, state.type, searchUsers]
  );

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      query: '',
      results: { users: [] },
    }));
  }, []);

  const saveToRecentSearches = useCallback(
    async (query: string) => {
      try {
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery) return;

        const updatedSearches = [
          trimmedQuery,
          ...state.recentSearches.filter(s => s !== trimmedQuery),
        ].slice(0, 10); // Keep only last 10 searches

        setState(prev => ({ ...prev, recentSearches: updatedSearches }));
        await AsyncStorage.setItem(
          'hivesnaps_recent_searches',
          JSON.stringify(updatedSearches)
        );
      } catch (err) {
        console.log('Error saving recent search:', err);
      }
    },
    [state.recentSearches]
  );

  const saveToRecentHashtags = useCallback(
    async (hashtag: string) => {
      try {
        const cleanHashtag = hashtag.replace('#', '').trim().toLowerCase();
        if (!cleanHashtag) return;

        const updatedHashtags = [
          cleanHashtag,
          ...state.recentHashtags.filter(h => h !== cleanHashtag),
        ].slice(0, 10); // Keep only last 10 hashtags

        setState(prev => ({ ...prev, recentHashtags: updatedHashtags }));
        await AsyncStorage.setItem(
          'hivesnaps_recent_hashtags',
          JSON.stringify(updatedHashtags)
        );
      } catch (err) {
        console.log('Error saving recent hashtag:', err);
      }
    },
    [state.recentHashtags]
  );

  const removeRecentSearch = useCallback(
    async (searchTerm: string) => {
      try {
        const filtered = state.recentSearches.filter(s => s !== searchTerm);
        setState(prev => ({ ...prev, recentSearches: filtered }));
        await AsyncStorage.setItem(
          'hivesnaps_recent_searches',
          JSON.stringify(filtered)
        );
      } catch (error) {
        console.error('Error removing recent search:', error);
      }
    },
    [state.recentSearches]
  );

  const removeRecentHashtag = useCallback(
    async (hashtag: string) => {
      try {
        const filtered = state.recentHashtags.filter(h => h !== hashtag);
        setState(prev => ({ ...prev, recentHashtags: filtered }));
        await AsyncStorage.setItem(
          'hivesnaps_recent_hashtags',
          JSON.stringify(filtered)
        );
      } catch (error) {
        console.error('Error removing recent hashtag:', error);
      }
    },
    [state.recentHashtags]
  );

  const loadRecentSearches = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('hivesnaps_recent_searches');
      if (stored) {
        setState(prev => ({ ...prev, recentSearches: JSON.parse(stored) }));
      }

      const storedHashtags = await AsyncStorage.getItem(
        'hivesnaps_recent_hashtags'
      );
      if (storedHashtags) {
        setState(prev => ({
          ...prev,
          recentHashtags: JSON.parse(storedHashtags),
        }));
      }
    } catch (err) {
      console.log('Error loading recent searches:', err);
    }
  }, []);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));
  }, []);

  const setType = useCallback((type: SearchType) => {
    setState(prev => ({ ...prev, type, results: { users: [] } }));
  }, []);

  return {
    ...state,
    setQuery,
    setType,
    search,
    clearResults,
    saveToRecentSearches,
    saveToRecentHashtags,
    removeRecentSearch,
    removeRecentHashtag,
    loadRecentSearches,
  };
};
