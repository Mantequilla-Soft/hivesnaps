/**
 * Audio Upload Service for 3Speak Audio API
 * Handles uploading audio recordings to IPFS via audio.3speak.tv
 */

import * as FileSystem from 'expo-file-system/legacy';
import { THREE_SPEAK_API_KEY, AUDIO_API_ENDPOINT } from '../app/config/env';

/**
 * Type definition for FormData blob in React Native
 */
interface ReactNativeBlob {
  uri: string;
  type: string;
  name: string;
}

export interface AudioUploadOptions {
  title?: string;
  description?: string;
}

export interface AudioUploadResult {
  success: boolean;
  permlink: string;
  cid: string;
  playUrl: string;
  apiUrl: string;
  error?: string;
}

const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024; // 50MB limit

/**
 * Get audio duration from file URI
 * For now, this would need to be passed in, but in real implementation
 * we could use expo-av or similar to extract duration
 */
export function calculateAudioDuration(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

/**
 * Upload audio to 3Speak Audio API
 * @param audioSource - The audio to upload, either a Blob or a file URI string
 * @param durationSeconds - Duration of the audio in seconds
 * @param username - Hive username uploading the audio
 * @param options - Optional metadata (title, description)
 * @returns Upload result with permlink and playUrl
 */
export async function uploadAudioTo3Speak(
  audioSource: Blob | string,
  durationSeconds: number,
  username: string,
  options: AudioUploadOptions = {}
): Promise<AudioUploadResult> {
  try {
    // Resolve and validate file size
    let fileSizeBytes: number;
    let base64Data: string;
    let mimeType: string;

    if (typeof audioSource === 'string') {
      // audioSource is a file URI - use Expo FileSystem for reliable local file access
      const fileInfo = await FileSystem.getInfoAsync(audioSource);
      if (!fileInfo.exists || fileInfo.size == null) {
        return {
          success: false,
          permlink: '',
          cid: '',
          playUrl: '',
          apiUrl: '',
          error: 'Audio file does not exist or size could not be determined',
        };
      }
      fileSizeBytes = fileInfo.size;

      // Read file directly to base64 using FileSystem (more reliable than fetch + FileReader)
      base64Data = await FileSystem.readAsStringAsync(audioSource, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine MIME type from file extension
      mimeType = audioSource.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';
    } else {
      // audioSource is a Blob - convert using FileReader
      fileSizeBytes = audioSource.size;
      mimeType = audioSource.type || 'audio/mpeg';

      const reader = new FileReader();
      base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract the base64 part (after "data:audio/...;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => {
          reject(new Error('Failed to read audio blob'));
        };
        reader.readAsDataURL(audioSource);
      });
    }

    // Validate file size
    if (fileSizeBytes > MAX_AUDIO_FILE_BYTES) {
      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: `Audio file is too large (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB). Maximum file size is 50 MB.`,
      };
    }

    // Validate duration
    if (durationSeconds <= 0) {
      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: 'Invalid audio duration',
      };
    }

    console.log('[Audio Upload] Starting upload...');
    console.log('[Audio Upload] MIME type:', mimeType);
    console.log('[Audio Upload] File size:', fileSizeBytes, 'bytes');
    console.log('[Audio Upload] Duration:', durationSeconds, 'seconds');
    console.log('[Audio Upload] Username:', username);
    console.log('[Audio Upload] Converted to base64, length:', base64Data.length);

    // Create FormData for multipart upload
    const formData = new FormData();

    // In React Native, append base64 data with explicit type info
    const audioBlob: ReactNativeBlob = {
      uri: `data:${mimeType};base64,${base64Data}`,
      type: mimeType,
      name: `audio-${Date.now()}.m4a`,
    };
    formData.append('audio', audioBlob as any);

    formData.append('duration', durationSeconds.toString());
    formData.append('format', 'm4a');

    // Append optional metadata
    if (options.title) {
      formData.append('title', options.title);
    }
    if (options.description) {
      formData.append('description', options.description);
    }

    // Upload to 3Speak Audio API
    const uploadUrl = `${AUDIO_API_ENDPOINT}/api/audio/upload`;
    console.log('[Audio Upload] URL:', uploadUrl);
    console.log('[Audio Upload] Sending FormData...');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': THREE_SPEAK_API_KEY,
        'X-User': username,
      },
      body: formData,
    });

    console.log('[Audio Upload] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Audio Upload] Upload failed:', response.status, errorText);

      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (parseError: unknown) {
        console.debug('[Audio Upload] Failed to parse error response:', parseError);
      }

      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: errorMessage,
      };
    }

    const result = await response.json();

    // Validate required fields in response
    if (!result.permlink || !result.playUrl) {
      console.error('[Audio Upload] Invalid response - missing required fields:', result);
      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: 'Invalid response from server - missing required fields',
      };
    }

    console.log('[Audio Upload] Success! Permlink:', result.permlink);

    return {
      success: true,
      permlink: result.permlink,
      cid: result.cid || '',
      playUrl: result.playUrl,
      apiUrl: result.apiUrl || '',
    };
  } catch (error: any) {
    console.error('[Audio Upload] Error:', error.message);
    console.error('[Audio Upload] Full error:', error);
    return {
      success: false,
      permlink: '',
      cid: '',
      playUrl: '',
      apiUrl: '',
      error: error.message || 'Failed to upload audio',
    };
  }
}

/**
 * Extract audio permlink from 3Speak audio URL
 * Handles formats like: https://audio.3speak.tv/play?a=w2ehm8pr
 */
export function extractAudioPermlink(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('a');
  } catch {
    return null;
  }
}

/**
 * Generate audio embed URL for iFrame display
 * Uses minimal mode with iframe=1 for clean embedding
 * @param permlink - Audio permlink from upload
 * @returns iFrame src URL
 */
export function generateAudioEmbedUrl(permlink: string): string {
  return `${AUDIO_API_ENDPOINT}/play?a=${permlink}&mode=minimal&iframe=1`;
}
