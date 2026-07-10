// Giphy API utility for GIF search and retrieval
// Using Giphy API v1 - docs: https://developers.giphy.com/docs/api/endpoint

const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';
const FETCH_TIMEOUT_MS = 10_000;

interface GiphyImage {
  url: string;
  width: string;
  height: string;
  size?: string;
}

export interface GiphyGif {
  id: string;
  title: string;
  images: {
    original?: GiphyImage;
    fixed_width?: GiphyImage;
    fixed_width_small?: GiphyImage;
    preview_gif?: GiphyImage;
    downsized?: GiphyImage;
  };
}

// Giphy doesn't guarantee every image format is present for every GIF, and RN's
// fetch has no default timeout — an unresponsive API would otherwise spin the
// picker's loading state forever and leak the pending request past modal close.
const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export interface GiphySearchResponse {
  data: GiphyGif[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

// Search GIFs by query term
export const searchGifs = async (
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<GiphySearchResponse> => {
  if (!GIPHY_API_KEY) {
    throw new Error('Giphy API key not configured');
  }

  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    q: query,
    limit: limit.toString(),
    offset: offset.toString(),
    rating: 'g',
    lang: 'en',
  });

  try {
    const response = await fetchWithTimeout(`${GIPHY_BASE_URL}/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(
        `Giphy API error: ${response.status} ${response.statusText}`
      );
    }

    const data: GiphySearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching GIFs:', error);
    throw error;
  }
};

// Get trending GIFs (for default/empty search)
export const getTrendingGifs = async (
  limit: number = 20
): Promise<GiphySearchResponse> => {
  if (!GIPHY_API_KEY) {
    throw new Error('Giphy API key not configured');
  }

  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: limit.toString(),
    rating: 'g',
  });

  try {
    const response = await fetchWithTimeout(`${GIPHY_BASE_URL}/trending?${params.toString()}`);

    if (!response.ok) {
      throw new Error(
        `Giphy API error: ${response.status} ${response.statusText}`
      );
    }

    const data: GiphySearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting trending GIFs:', error);
    throw error;
  }
};

// Utility to get the best GIF format for mobile display
export const getBestGifUrl = (gif: GiphyGif): string => {
  // Prefer fixed_width for mobile to save bandwidth, fall back to original
  if (gif.images.fixed_width?.url) {
    return gif.images.fixed_width.url;
  }
  return gif.images.original?.url || '';
};

// Utility to get preview image URL for thumbnails
export const getGifPreviewUrl = (gif: GiphyGif): string => {
  return (
    gif.images.preview_gif?.url ||
    gif.images.fixed_width_small?.url ||
    ''
  );
};
