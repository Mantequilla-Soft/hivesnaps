// Hive Images Upload Utility for React Native Expo
// Uses images.hive.blog as primary, images.3speak.tv as fallback
// Usage: const url = await uploadImageToHive({ uri, name, type }, { username, privateKey });

import * as FileSystem from 'expo-file-system/legacy';
import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
import { THREESPEAK_IMAGE_SERVER, THREESPEAK_IMAGE_API_KEY } from '../app/config/env';

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

const UPLOAD_TIMEOUT_MS = 15_000;

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
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const content = Buffer.from(base64Data, 'base64');
    const hash = sha256.create();
    hash.update('ImageSigningChallenge');
    hash.update(content);
    const hashHex = hash.hex();
    const key = PrivateKey.fromString(privateKey);
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const signature = key.sign(hashBuffer);
    return signature.toString();
  } catch (error) {
    if (__DEV__) console.error('Error creating image signature:', error);
    throw new Error('Failed to create image signature');
  }
}

function isCloudflareChallenge(text: string): boolean {
  return text.includes('_cf_chl_opt') || text.includes('challenge-platform');
}

/**
 * POST a file to an upload endpoint and return the resulting image URL.
 * Handles timeout, Cloudflare challenge detection, and content-type validation.
 * @private
 */
async function fetchImageUpload(
  url: string,
  file: HiveImageUploadFile,
  extraHeaders?: Record<string, string>
): Promise<HiveImageUploadResult> {
  const formData = new FormData();
  const fileData: ReactNativeFormDataFile = { uri: file.uri, name: file.name, type: file.type };
  formData.append('image', fileData);

  if (__DEV__) console.log(`Uploading to: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json', ...extraHeaders },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      const errorText = await response.text();
      if (isCloudflareChallenge(errorText)) {
        throw new Error(`Cloudflare challenge blocked upload (HTTP ${response.status})`);
      }
      throw new Error(`Upload failed with status ${response.status}`);
    }

    if (!isJson) {
      const responseText = await response.text();
      if (isCloudflareChallenge(responseText)) {
        throw new Error('Cloudflare challenge blocked upload');
      }
      throw new Error(`Unexpected response type: ${contentType || 'unknown'}`);
    }

    const result = await response.json();
    if (!result.url) {
      throw new Error('No URL returned from image upload');
    }

    if (__DEV__) console.log(`✅ Upload successful: ${result.url}`);
    return { url: result.url };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Image upload request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload image to Hive images service with automatic fallback
 * Tries images.hive.blog first, then images.3speak.tv if it fails
 * @param file - File object with uri, name, and type
 * @param options - Upload options including username and privateKey
 * @returns Promise with uploaded image URL
 */
export async function uploadImageToHive(
  file: HiveImageUploadFile,
  options: HiveImageUploadOptions
): Promise<HiveImageUploadResult> {
  if (__DEV__) console.log('Starting Hive image upload for:', file.name);

  const signature = await createImageSignature(file.uri, options.privateKey);

  const hiveUrl = `https://images.hive.blog/${options.username}/${signature}`;
  const threeSpeakUrl = `${THREESPEAK_IMAGE_SERVER}/upload`;

  try {
    if (__DEV__) console.log('📤 Trying primary endpoint: images.hive.blog');
    return await fetchImageUpload(hiveUrl, file);
  } catch (primaryError) {
    if (__DEV__) console.warn('⚠️  Primary endpoint failed:', primaryError instanceof Error ? primaryError.message : 'Unknown error');
    if (__DEV__) console.log('🔄 Falling back to: images.3speak.tv');

    try {
      return await fetchImageUpload(threeSpeakUrl, file, { Authorization: `Bearer ${THREESPEAK_IMAGE_API_KEY}` });
    } catch (fallbackError) {
      throw new Error(
        `Image upload failed on all endpoints. ` +
        `Primary (hive.blog): ${primaryError instanceof Error ? primaryError.message : 'Unknown'}. ` +
        `Fallback (3speak.tv): ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
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
 * Convenience function - returns URL string directly instead of result object
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
