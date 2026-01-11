/**
 * Image Converter Utility
 * Converts HEIC and other image formats to JPEG
 * Ensures web compatibility for images uploaded from iOS devices
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export interface ConvertedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Converts an image to JPEG format
 * Handles HEIC images from iOS devices automatically
 * 
 * @param uri - The URI of the image to convert
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns Converted image with JPEG format
 */
export async function convertToJPEG(
  uri: string,
  quality: number = 0.8
): Promise<ConvertedImage> {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error(`Image file not found: ${uri}`);
    }

    // Use ImageManipulator to convert to JPEG
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
 * Smart image conversion - only converts HEIC/HEIF to JPEG, preserves GIFs and PNGs
 * 
 * @param uri - The URI of the image
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

    // Preserve GIF animations and PNG transparency
    if (extension === 'gif') {
      console.log('[imageConverter] Preserving GIF animation');
      return {
        uri,
        type: 'image/gif',
        name: originalFileName || `image-${Date.now()}.gif`,
      };
    }

    if (extension === 'png') {
      console.log('[imageConverter] Preserving PNG transparency');
      return {
        uri,
        type: 'image/png',
        name: originalFileName || `image-${Date.now()}.png`,
      };
    }

    // For JPEG and other formats, pass through as JPEG
    console.log('[imageConverter] Passing through as JPEG');
    return {
      uri,
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
