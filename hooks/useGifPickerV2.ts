import { useState, useCallback } from 'react';
import { searchGifs as searchGifsApi, getTrendingGifs, GiphyGif, GiphySearchResponse } from '../utils/giphyApi';

/**
 * Mode for GIF picker - determines whether we store single GIF or array
 */
export type GifPickerMode = 'single' | 'multiple';

/**
 * Callback function type for when a GIF is selected
 */
export type GifSelectionCallback = (gifUrl: string) => void;

/**
 * State interface for the GIF picker
 */
interface GifPickerState {
  readonly modalVisible: boolean;
  readonly searchQuery: string;
  readonly results: GiphyGif[];
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Return type for the useGifPicker hook
 */
export interface UseGifPickerReturn {
  // State
  readonly state: GifPickerState;
  
  // Modal controls
  readonly openPicker: () => void;
  readonly closePicker: () => void;
  
  // Search functionality
  readonly setSearchQuery: (query: string) => void;
  readonly searchGifs: (query: string) => Promise<void>;
  readonly clearResults: () => void;
  
  // GIF selection
  readonly selectGif: (gifUrl: string) => void;
  
  // Error handling
  readonly clearError: () => void;
}

/**
 * Configuration options for the GIF picker hook
 */
export interface GifPickerConfig {
  /** Callback function called when a GIF is selected */
  onGifSelected: GifSelectionCallback;
  /** Whether to load trending GIFs when picker opens */
  loadTrendingOnOpen?: boolean;
  /** Number of GIFs to fetch per request */
  limit?: number;
}

/**
 * Professional, reusable GIF picker hook based on the working ComposeScreen implementation
 * 
 * Features:
 * - TypeScript safe with proper interfaces
 * - Handles both search and trending GIFs
 * - Proper error handling
 * - Callback-based GIF selection
 * - Loading states
 * - Memory efficient (clears results on close)
 * 
 * @param config Configuration object with callbacks and options
 * @returns Hook interface with state and methods
 */
export const useGifPicker = (config: GifPickerConfig): UseGifPickerReturn => {
  const {
    onGifSelected,
    loadTrendingOnOpen = true, // Changed to false to match old behavior
    limit = 20
  } = config;

  // Internal state management
  const [state, setState] = useState<GifPickerState>({
    modalVisible: false,
    searchQuery: '',
    results: [],
    loading: false,
    error: null,
  });

  /**
   * Opens the GIF picker modal and loads trending GIFs
   */
  const openPicker = useCallback(async () => {
    setState(prev => ({
      ...prev,
      modalVisible: true,
      searchQuery: '',
      results: [],
      error: null,
    }));

    // Always load trending GIFs when opening modal (matches old behavior)
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response: GiphySearchResponse = await getTrendingGifs(limit);
      
      setState(prev => ({
        ...prev,
        results: response.data,
        loading: false,
      }));
    } catch (error) {
      console.error('[useGifPicker] Error loading trending GIFs:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load trending GIFs',
      }));
    }
  }, [limit]);

  /**
   * Closes the GIF picker modal and clears state
   */
  const closePicker = useCallback(() => {
    setState({
      modalVisible: false,
      searchQuery: '',
      results: [],
      loading: false,
      error: null,
    });
  }, []);

  /**
   * Updates the search query (for controlled input)
   */
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  /**
   * Searches for GIFs or loads trending if query is empty
   */
  const searchGifs = useCallback(async (query: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response: GiphySearchResponse = query.trim()
        ? await searchGifsApi(query.trim(), limit)
        : await getTrendingGifs(limit);

      setState(prev => ({
        ...prev,
        results: response.data,
        loading: false,
      }));
    } catch (error) {
      console.error('[useGifPicker] Error searching GIFs:', error);
      setState(prev => ({
        ...prev,
        results: [],
        loading: false,
        error: query.trim() 
          ? `Failed to search for "${query}"`
          : 'Failed to load trending GIFs',
      }));
    }
  }, [limit]);

  /**
   * Clears search results
   */
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      searchQuery: '',
      error: null,
    }));
  }, []);

  /**
   * Handles GIF selection - calls callback and closes modal
   */
  const selectGif = useCallback((gifUrl: string) => {
    if (!gifUrl || typeof gifUrl !== 'string') {
      console.error('[useGifPicker] Invalid GIF URL provided:', gifUrl);
      return;
    }

    try {
      // Call the provided callback
      onGifSelected(gifUrl);
      
      // Close the modal
      closePicker();
    } catch (error) {
      console.error('[useGifPicker] Error in GIF selection callback:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to select GIF',
      }));
    }
  }, [onGifSelected, closePicker]);

  /**
   * Clears any error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    openPicker,
    closePicker,
    setSearchQuery,
    searchGifs,
    clearResults,
    selectGif,
    clearError,
  };
};

/**
 * Helper function to extract the best GIF URL for display
 * Re-exported from giphyApi for convenience
 */
export { getBestGifUrl, getGifPreviewUrl } from '../utils/giphyApi';

/**
 * Type exports for external use
 */
export type { GiphyGif, GiphySearchResponse } from '../utils/giphyApi';
