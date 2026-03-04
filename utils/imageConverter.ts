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
 * Normalizes an iOS Photo Library URI to a file:// URI by copying to cache
 * On Android or for file:// URIs, returns the original URI
 * 
 * @param uri - The source URI
 * @param extension - File extension to use for the destination
 * @returns Normalized file:// URI
 */
async function normalizeURIToFile(uri: string, extension: string): Promise<string> {
  if (!isIOSPhotoLibraryURI(uri)) {
    return uri;
  }

  // Copy from photo library to cache directory
  const destPath = `${FileSystem.cacheDirectory}image-${Date.now()}.${extension}`;

  if (__DEV__) {
    console.log(`[imageConverter] Copying from ph:// to file:// URI`);
  }

  try {
    await FileSystem.copyAsync({ from: uri, to: destPath });
    return destPath;
  } catch (error) {
    if (__DEV__) {
      console.error('[imageConverter] Failed to copy from photo library:', error);
    }
    throw new Error(`Failed to access image from photo library: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Preserve PNG transparency using ImageManipulator (handles ph:// URIs natively)
    if (extension === 'png') {
      console.log('[imageConverter] Processing PNG (preserving transparency)');
      // ImageManipulator handles ph:// URIs and outputs file:// URI while preserving PNG format
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [], // No transformations
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

    // For JPEG and other formats, normalize ph:// URI if needed and pass through
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
