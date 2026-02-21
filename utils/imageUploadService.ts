// Image Upload Service - Unified interface supporting both Cloudinary and Hive
// Provides seamless migration from Cloudinary to Hive images.hive.blog

import { uploadImageToCloudinaryFixed } from './cloudinaryImageUploadFixed';
import { uploadImageToHive, HiveImageUploadFile } from './hiveImageUpload';
import { SessionService } from '../services/SessionService';

export interface UploadResult {
  url: string;
  provider: 'cloudinary' | 'hive';
  cost: number; // Estimated cost in USD
}

export interface ImageUploadOptions {
  provider?: 'cloudinary' | 'hive' | 'auto';
  username?: string;
  privateKey?: string;
  fallbackToCloudinary?: boolean;
}

/**
 * Unified image upload function
 * Supports both Cloudinary (legacy) and Hive (new, cost-effective)
 * @param file - File object with uri, name, and type
 * @param options - Upload options
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
    fallbackToCloudinary = true,
  } = options;

  console.log(`[ImageUploadService] Starting upload with provider: ${provider}`);

  // Auto-detection: prefer Hive if credentials available
  if (provider === 'auto') {
    const hasHiveCredentials = username && privateKey;
    const selectedProvider = hasHiveCredentials ? 'hive' : 'cloudinary';
    console.log(`[ImageUploadService] Auto-selected provider: ${selectedProvider}`);

    return uploadImage(file, {
      ...options,
      provider: selectedProvider
    });
  }

  // Hive upload
  if (provider === 'hive') {
    if (!username || !privateKey) {
      if (fallbackToCloudinary) {
        console.warn('[ImageUploadService] Hive credentials missing, falling back to Cloudinary');
        return uploadImage(file, { ...options, provider: 'cloudinary' });
      }
      throw new Error('Hive upload requires username and privateKey');
    }

    try {
      console.log('[ImageUploadService] Uploading to Hive...');
      const result = await uploadImageToHive(file, { username, privateKey });

      return {
        url: result.url,
        provider: 'hive',
        cost: 0, // Free!
      };
    } catch (error) {
      console.error('[ImageUploadService] Hive upload failed:', error);

      if (fallbackToCloudinary) {
        console.warn('[ImageUploadService] Falling back to Cloudinary due to Hive failure');
        return uploadImage(file, { ...options, provider: 'cloudinary' });
      }

      throw error;
    }
  }

  // Cloudinary upload (legacy)
  if (provider === 'cloudinary') {
    try {
      console.log('[ImageUploadService] Uploading to Cloudinary...');
      const url = await uploadImageToCloudinaryFixed(file);

      return {
        url,
        provider: 'cloudinary',
        cost: 0.001, // Estimated cost per image
      };
    } catch (error) {
      console.error('[ImageUploadService] Cloudinary upload failed:', error);
      throw error;
    }
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
    const privateKey = SessionService.getCurrentPostingKey();

    if (!privateKey) {
      return null;
    }

    return { username, privateKey };
  } catch (error) {
    console.error('[ImageUploadService] Failed to get Hive credentials:', error);
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
    console.log('[ImageUploadService] No username provided, using Cloudinary');
    return uploadImage(file, { provider: 'cloudinary' });
  }

  const credentials = await getHiveCredentials(username);

  if (credentials) {
    console.log('[ImageUploadService] Hive credentials found, using Hive upload');
    return uploadImage(file, {
      provider: 'hive',
      username: credentials.username,
      privateKey: credentials.privateKey,
      fallbackToCloudinary: true,
    });
  }

  console.log('[ImageUploadService] No Hive credentials, using Cloudinary');
  return uploadImage(file, { provider: 'cloudinary' });
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
