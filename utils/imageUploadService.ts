// Image Upload Service - Hive blockchain image hosting
// Zero-cost image uploads using images.hive.blog with ecency.com fallback

import { uploadImageToHive, HiveImageUploadFile } from './hiveImageUpload';
import * as SecureStore from 'expo-secure-store';

export interface UploadResult {
  url: string;
  provider: 'hive';
  cost: number; // Estimated cost in USD (always 0 for Hive)
}

export interface ImageUploadOptions {
  provider?: 'hive' | 'auto';
  username?: string;
  privateKey?: string;
}

/**
 * Hive image upload function with automatic endpoint fallback
 * Uses images.hive.blog with automatic fallback to images.ecency.com
 * @param file - File object with uri, name, and type
 * @param options - Upload options (requires username and privateKey)
 * @returns Promise with upload result including URL and provider info
 */
export async function uploadImage(
  file: HiveImageUploadFile,
  options: ImageUploadOptions = {}
): Promise<UploadResult> {
  const {
    provider = 'auto',
    username,
    privateKey,
  } = options;

  if (__DEV__) console.log(`[ImageUploadService] Starting upload with provider: ${provider}`);

  // Auto-detection: requires Hive credentials
  if (provider === 'auto') {
    if (!username || !privateKey) {
      throw new Error('Image upload requires Hive credentials (username and privateKey). Please log in to upload images.');
    }
    if (__DEV__) console.log(`[ImageUploadService] Auto-selected provider: hive`);

    return uploadImage(file, {
      ...options,
      provider: 'hive'
    });
  }

  // Hive upload with dual-endpoint fallback
  if (provider === 'hive') {
    if (!username || !privateKey) {
      throw new Error('Hive upload requires username and privateKey');
    }

    if (__DEV__) console.log('[ImageUploadService] Uploading to Hive...');
    const result = await uploadImageToHive(file, { username, privateKey });

    return {
      url: result.url,
      provider: 'hive',
      cost: 0, // Free!
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Get user credentials for Hive upload
 * @param username - Hive username
 * @returns Promise with credentials or null if not available
 */
export async function getHiveCredentials(username: string): Promise<{
  username: string;
  privateKey: string;
} | null> {
  try {
    const privateKey = await SecureStore.getItemAsync('hive_posting_key');

    if (!privateKey) {
      return null;
    }

    return { username, privateKey };
  } catch (error) {
    if (__DEV__) console.error('[ImageUploadService] Failed to get Hive credentials:', error);
    return null;
  }
}

/**
 * Upload with automatic credential detection
 * @param file - File object with uri, name, and type
 * @param username - Current username
 * @returns Promise with upload result
 */
export async function uploadImageSmart(
  file: HiveImageUploadFile,
  username?: string | null
): Promise<UploadResult> {
  if (!username) {
    throw new Error('Image upload requires login. Please log in to upload images.');
  }

  const credentials = await getHiveCredentials(username);

  if (!credentials) {
    throw new Error('Hive credentials not found. Please ensure you are properly logged in.');
  }

  if (__DEV__) console.log('[ImageUploadService] Hive credentials found, using Hive upload');
  return uploadImage(file, {
    provider: 'hive',
    username: credentials.username,
    privateKey: credentials.privateKey,
  });
}

/**
 * Compatibility function for existing code
 * @param file - File object with uri, name, and type
 * @returns Promise with uploaded image URL (string)
 */
export async function uploadImageCompatible(
  file: HiveImageUploadFile
): Promise<string> {
  const result = await uploadImageSmart(file);
  return result.url;
}
