/**
 * Image Converter Utility
 * Converts HEIC and other image formats to JPEG
 * Ensures web compatibility for images uploaded from iOS devices
 * Handles iOS ph:// URIs from the Photo Library
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface ConvertedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Converts an image to JPEG format
 * Handles HEIC images from iOS devices automatically
 * Also handles iOS ph:// URIs from the Photo Library
 * 
 * @param uri - The URI of the image to convert (supports file:// and ph:// schemes)
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns Converted image with JPEG format
 */
export async function convertToJPEG(
  uri: string,
  quality: number = 0.8
): Promise<ConvertedImage> {
  try {
    // Use ImageManipulator to convert to JPEG
    // ImageManipulator handles both file:// and ph:// URIs on iOS natively
    // This automatically handles HEIC and other formats
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No transformations, just format conversion
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[imageConverter] Error converting image to JPEG:', error);
    }
    throw new Error(`Failed to convert image to JPEG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts multiple images to JPEG format
 * 
 * @param uris - Array of image URIs to convert
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns Array of converted images
 */
export async function convertMultipleToJPEG(
  uris: string[],
  quality: number = 0.8
): Promise<ConvertedImage[]> {
  const promises = uris.map(uri => convertToJPEG(uri, quality));
  return Promise.all(promises);
}

export interface SmartConversionResult {
  uri: string;
  type: string;
  name: string;
  width?: number;
  height?: number;
}

/**
 * Checks if a URI is an iOS Photo Library reference (ph://) that needs normalization
 */
function isIOSPhotoLibraryURI(uri: string): boolean {
  return Platform.OS === 'ios' && (uri.startsWith('ph://') || uri.startsWith('assets-library://'));
}

/**
 * Normalizes an iOS Photo Library URI to a file:// URI.
 * On Android or for file:// URIs, returns the original URI.
 *
 * Strategy:
 *  1. Try FileSystem.copyAsync (preserves original bytes — important for GIFs).
 *  2. If copyAsync can't handle the ph:// URI, fall back to ImageManipulator
 *     which handles ph:// natively but re-encodes the image (loses GIF animation).
 *
 * @param uri - The source URI
 * @param extension - File extension to use for the destination
 * @returns Normalized file:// URI
 */
async function normalizeURIToFile(uri: string, extension: string): Promise<string> {
  if (!isIOSPhotoLibraryURI(uri)) {
    return uri;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory unavailable');
  }

  // Sanitize extension to prevent invalid cache paths (ph:// URIs may lack proper extensions)
  const safeExtension = /^[a-z0-9]+$/i.test(extension) ? extension : 'jpg';

  // Copy from photo library to cache directory
  const destPath = `${FileSystem.cacheDirectory}image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;

  if (__DEV__) {
    console.log(`[imageConverter] Normalizing ph:// URI to file://`);
  }

  // Attempt 1: copyAsync preserves original bytes (critical for GIF animations)
  try {
    await FileSystem.copyAsync({ from: uri, to: destPath });
    return destPath;
  } catch (copyError) {
    if (__DEV__) {
      console.warn('[imageConverter] copyAsync failed for ph:// URI, falling back to ImageManipulator:', copyError);
    }
  }

  // Attempt 2: ImageManipulator can resolve ph:// URIs natively but re-encodes
  // the image (GIF animations will be lost, JPEG may lose quality)
  try {
    const format = safeExtension === 'png'
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG;
    const result = await ImageManipulator.manipulateAsync(uri, [], { format });
    return result.uri;
  } catch (manipError) {
    if (__DEV__) {
      console.error('[imageConverter] ImageManipulator fallback also failed:', manipError);
    }
    throw new Error(`Failed to access image from photo library: ${manipError instanceof Error ? manipError.message : 'Unknown error'}`);
  }
}

/**
 * Smart image conversion - only converts HEIC/HEIF to JPEG, preserves GIFs and PNGs
 * Handles iOS ph:// URIs by normalizing them to file:// URIs
 * 
 * @param uri - The URI of the image (supports file://, ph://, and assets-library:// schemes)
 * @param originalFileName - Original file name (optional, for extension detection)
 * @param quality - JPEG quality for conversion (0-1), defaults to 0.8
 * @returns File info ready for upload with proper mime type
 */
export async function convertImageSmart(
  uri: string,
  originalFileName?: string,
  quality: number = 0.8
): Promise<SmartConversionResult> {
  try {
    // Determine file extension
    const extension = (originalFileName || uri).toLowerCase().split('.').pop() || '';

    console.log('[imageConverter] Smart conversion - file extension:', extension);

    // Only convert HEIC/HEIF to JPEG (iOS photos)
    const needsConversion = extension === 'heic' || extension === 'heif';

    if (needsConversion) {
      console.log('[imageConverter] Converting HEIC/HEIF to JPEG');
      const converted = await convertToJPEG(uri, quality);
      return {
        uri: converted.uri,
        type: 'image/jpeg',
        name: `image-${Date.now()}.jpg`,
        width: converted.width,
        height: converted.height,
      };
    }

    // Preserve GIF animations - normalize ph:// URI to file:// via copy
    if (extension === 'gif') {
      console.log('[imageConverter] Preserving GIF animation');
      const normalizedUri = await normalizeURIToFile(uri, 'gif');
      return {
        uri: normalizedUri,
        type: 'image/gif',
        name: originalFileName || `image-${Date.now()}.gif`,
      };
    }

    // Preserve PNG transparency — only run through ImageManipulator for ph:// URIs
    if (extension === 'png') {
      if (isIOSPhotoLibraryURI(uri)) {
        console.log('[imageConverter] Converting ph:// PNG via ImageManipulator');
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { format: ImageManipulator.SaveFormat.PNG }
        );
        return {
          uri: result.uri,
          type: 'image/png',
          name: originalFileName || `image-${Date.now()}.png`,
          width: result.width,
          height: result.height,
        };
      }
      console.log('[imageConverter] Preserving PNG as-is (already file:// URI)');
      return {
        uri,
        type: 'image/png',
        name: originalFileName || `image-${Date.now()}.png`,
      };
    }

    // JPEG requires no format conversion, so we copy to file:// manually via
    // normalizeURIToFile since we can't use ImageManipulator without re-encoding.
    // (HEIC/PNG use ImageManipulator which handles ph:// natively as part of conversion.)
    console.log('[imageConverter] Processing as JPEG');
    const normalizedUri = await normalizeURIToFile(uri, extension || 'jpg');
    return {
      uri: normalizedUri,
      type: 'image/jpeg',
      name: originalFileName || `image-${Date.now()}.jpg`,
    };

  } catch (error) {
    if (__DEV__) {
      console.error('[imageConverter] Error in smart conversion:', error);
    }
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
