import { extractImageUrls } from './extractImageUrls';
import { extractRawImageUrls } from './rawImageUrls';
import { proxyImageUrl } from './proxyImageUrl';

export interface ImageGalleryItem {
  uri: string;
}

/**
 * Extracts all images from a snap's body and returns them as a gallery array.
 * Combines both markdown/HTML images and raw image URLs.
 * 
 * @param body - The snap body content (markdown/HTML)
 * @returns Array of image gallery items with proxied URLs
 */
export function buildImageGalleryFromSnap(body: string): ImageGalleryItem[] {
  if (!body || typeof body !== 'string') {
    return [];
  }

  // Extract markdown/HTML images: ![alt](url) and <img src="url">
  const markdownImages = extractImageUrls(body);
  
  // Extract raw image URLs (direct URLs to image files)
  const rawImages = extractRawImageUrls(body);
  
  // Combine and deduplicate images
  const allImageUrls = [...markdownImages, ...rawImages];
  const uniqueUrls = Array.from(new Set(allImageUrls));
  
  // Convert to gallery format with proxied URLs
  return uniqueUrls
    .filter(url => {
      // Filter out non-image URLs (hashtags, profiles, etc.)
      return url && 
             !url.startsWith('hashtag://') && 
             !url.startsWith('profile://') &&
             (/\.((jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?)$/i.test(url) ||
              url.startsWith('data:image/'));
    })
    .map(url => ({
      uri: proxyImageUrl(url),
    }));
}

/**
 * Finds the index of a specific image URL in the gallery array.
 * Handles URL normalization (query params, protocols, etc.).
 * 
 * @param gallery - The image gallery array
 * @param targetUrl - The URL to find
 * @returns The index of the image, or 0 if not found
 */
export function findImageIndexInGallery(
  gallery: ImageGalleryItem[],
  targetUrl: string
): number {
  if (!targetUrl || gallery.length === 0) {
    return 0;
  }
  
  // Try exact match first
  const exactIndex = gallery.findIndex(item => item.uri === targetUrl);
  if (exactIndex !== -1) {
    return exactIndex;
  }
  
  // Try matching without query parameters
  const normalizeUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      urlObj.search = '';
      return urlObj.toString();
    } catch {
      return url.split('?')[0];
    }
  };
  
  const normalizedTarget = normalizeUrl(targetUrl);
  const normalizedIndex = gallery.findIndex(item => 
    normalizeUrl(item.uri) === normalizedTarget
  );
  
  return normalizedIndex !== -1 ? normalizedIndex : 0;
}
