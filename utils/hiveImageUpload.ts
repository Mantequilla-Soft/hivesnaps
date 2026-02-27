// Hive Images Upload Utility for React Native Expo
// Uses images.hive.blog with images.ecency.com as fallback - Zero cost image hosting
// Automatically falls back to ecency.com if hive.blog is unavailable
// Usage: const url = await uploadImageToHive({ uri, name, type }, { username, privateKey });

import * as FileSystem from 'expo-file-system/legacy';
import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';

export interface HiveImageUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface HiveImageUploadOptions {
  username: string;
  privateKey: string;
}

export interface HiveImageUploadResult {
  url: string;
}

/**
 * React Native's FormData.append accepts this file structure for uploads
 */
interface ReactNativeFormDataFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Augment FormData to include React Native's file upload types
 * React Native extends FormData.append to accept file objects with uri/name/type
 */
declare global {
  interface FormData {
    append(name: string, value: ReactNativeFormDataFile): void;
  }
}

/**
 * Create signature for image upload to Hive images
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param privateKey - User's private posting key
 * @returns Promise with signature string
 */
async function createImageSignature(
  fileUri: string,
  privateKey: string
): Promise<string> {
  try {
    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to buffer
    const content = Buffer.from(base64Data, 'base64');

    // Create hash
    const hash = sha256.create();
    hash.update('ImageSigningChallenge');
    hash.update(content);
    const hashHex = hash.hex();

    // Sign the hash
    const key = PrivateKey.fromString(privateKey);
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const signature = key.sign(hashBuffer);

    return signature.toString();
  } catch (error) {
    if (__DEV__) console.error('Error creating image signature:', error);
    throw new Error('Failed to create image signature');
  }
}

/**
 * Upload image to a specific Hive images endpoint
 * @private
 */
async function uploadToEndpoint(
  endpoint: string,
  file: HiveImageUploadFile,
  username: string,
  signature: string
): Promise<HiveImageUploadResult> {
  const formData = new FormData();

  // React Native's FormData accepts file objects with uri, name, type properties
  const fileData: ReactNativeFormDataFile = {
    uri: file.uri,
    name: file.name,
    type: file.type,
  };

  // Type-safe append using module-augmented FormData interface
  formData.append('image', fileData);

  const uploadUrl = `${endpoint}/${username}/${signature}`;
  if (__DEV__) console.log(`Uploading to: ${uploadUrl}`);

  // Set up timeout for fetch request to avoid hanging indefinitely
  const controller = new AbortController();
  const timeoutMs = 15000; // 15 seconds
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (!result.url) {
      throw new Error('No URL returned from image upload');
    }

    if (__DEV__) console.log(`✅ Upload successful: ${result.url}`);
    return { url: result.url };
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new Error('Image upload request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload image to Hive images service with automatic fallback
 * Tries images.hive.blog first, then images.ecency.com if it fails
 * @param file - File object with uri, name, and type
 * @param options - Upload options including username and privateKey
 * @returns Promise with uploaded image URL
 */
export async function uploadImageToHive(
  file: HiveImageUploadFile,
  options: HiveImageUploadOptions
): Promise<HiveImageUploadResult> {
  if (__DEV__) console.log('Starting Hive image upload for:', file.name);

  // Create signature once (works for both endpoints)
  const signature = await createImageSignature(file.uri, options.privateKey);

  // Primary endpoint: images.hive.blog
  const primaryEndpoint = 'https://images.hive.blog';
  // Fallback endpoint: images.ecency.com
  const fallbackEndpoint = 'https://images.ecency.com';

  try {
    // Try primary endpoint first
    if (__DEV__) console.log('📤 Trying primary endpoint: images.hive.blog');
    return await uploadToEndpoint(primaryEndpoint, file, options.username, signature);
  } catch (primaryError) {
    if (__DEV__) console.warn('⚠️  Primary endpoint failed:', primaryError instanceof Error ? primaryError.message : 'Unknown error');
    if (__DEV__) console.log('🔄 Falling back to: images.ecency.com');

    try {
      // Try fallback endpoint
      return await uploadToEndpoint(fallbackEndpoint, file, options.username, signature);
    } catch (fallbackError) {
      // Both failed - throw comprehensive error
      if (__DEV__) console.error('❌ Both upload endpoints failed');
      throw new Error(
        `Image upload failed on all endpoints. ` +
        `Primary (hive.blog): ${primaryError instanceof Error ? primaryError.message : 'Unknown'}. ` +
        `Fallback (ecency.com): ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
      );
    }
  }
}

/**
 * Create markdown image markup for Hive post
 * @param imageUrl - URL of the uploaded image
 * @param altText - Alt text for the image
 * @returns Markdown image string
 */
export function createImageMarkdown(
  imageUrl: string,
  altText: string = 'image'
): string {
  return `![${altText}](${imageUrl})`;
}

/**
 * Legacy compatibility function - maintains same interface as Cloudinary
 * @param file - File object with uri, name, and type
 * @param username - Hive username
 * @param privateKey - Hive private posting key
 * @returns Promise with uploaded image URL (string)
 */
export async function uploadImageToHiveCompatible(
  file: HiveImageUploadFile,
  username: string,
  privateKey: string
): Promise<string> {
  const result = await uploadImageToHive(file, { username, privateKey });
  return result.url;
}
