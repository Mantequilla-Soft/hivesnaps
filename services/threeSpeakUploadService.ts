import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Upload, DetailedError } from 'tus-js-client';
import { THREE_SPEAK_API_KEY } from '../app/config/env';

const THREE_SPEAK_UPLOAD_ENDPOINT = 'https://embed.3speak.tv/uploads';
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks keep memory usage predictable on mobile
const DEFAULT_RETRY_DELAYS = [0, 2000, 5000, 10000];
const DEFAULT_FRONTEND_APP = 'snapie-mobile';

const MIME_FALLBACK = 'video/mp4';
const EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};

export interface LocalVideoAsset {
  uri: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
}

export interface PrepareVideoAssetOptions {
  filename?: string;
  mimeType?: string;
  durationMs?: number;
}

export interface VideoThumbnail {
  uri: string;
  width: number;
  height: number;
}

export interface GenerateThumbnailOptions {
  timeMs?: number;
  quality?: number;
}

export interface VideoUploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

export interface ThreeSpeakTusMetadataOverrides {
  /** Override the frontend app identifier if needed (defaults to snapie-mobile) */
  frontend_app?: string;
  /** Hive username (owner) for the video */
  owner?: string;
  /** Whether this upload should be treated as a short */
  short?: boolean;
  /** Optional thumbnail URL that 3Speak can reuse */
  thumbnail?: string;
  /** Arbitrary metadata entries forwarded to the Tus server */
  extra?: Record<string, string | number | undefined>;
}

export interface UploadVideoToThreeSpeakParams {
  asset: LocalVideoAsset;
  metadata?: ThreeSpeakTusMetadataOverrides;
  onProgress?: (progress: VideoUploadProgress) => void;
  signal?: AbortSignal;
  chunkSize?: number;
  retryDelays?: number[];
}

export interface ThreeSpeakUploadResult {
  uploadUrl: string;
  assetId: string;
  embedUrl: string;
}

function ensureApiKeyPresent(): string {
  if (!THREE_SPEAK_API_KEY) {
    throw new Error('3Speak API key missing. Set EXPO_PUBLIC_3SPEAK_API_KEY in your env.');
  }
  return THREE_SPEAK_API_KEY;
}

function guessMimeType(filename: string, explicit?: string): string {
  if (explicit) {
    return explicit;
  }
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension];
  }
  return MIME_FALLBACK;
}

export async function prepareLocalVideoAsset(
  uri: string,
  options: PrepareVideoAssetOptions = {}
): Promise<LocalVideoAsset> {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists) {
    throw new Error('Video file no longer exists at provided URI.');
  }

  const sizeBytes = typeof info.size === 'number' ? info.size : 0;
  if (sizeBytes === 0) {
    throw new Error('Video file has a size of 0 bytes.');
  }

  const filename = options.filename || uri.split('/').pop() || `snapie-video-${Date.now()}.mp4`;
  const mimeType = guessMimeType(filename, options.mimeType);

  return {
    uri,
    filename,
    mimeType,
    sizeBytes,
    durationMs: options.durationMs,
  };
}

export async function generateVideoThumbnail(
  uri: string,
  options: GenerateThumbnailOptions = {}
): Promise<VideoThumbnail> {
  const { timeMs = 750, quality = Platform.OS === 'ios' ? 0.7 : 0.5 } = options;
  const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
    time: timeMs,
    quality,
  });

  return {
    uri: thumbnail.uri,
    width: thumbnail.width ?? 0,
    height: thumbnail.height ?? 0,
  };
}

function sanitizeMetadataValue(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 256);
}

function buildTusMetadata(
  asset: LocalVideoAsset,
  overrides?: ThreeSpeakTusMetadataOverrides
): Record<string, string> {
  const meta: Record<string, string | undefined> = {
    filename: asset.filename,
    filetype: asset.mimeType,
    frontend_app: overrides?.frontend_app || DEFAULT_FRONTEND_APP,
    owner: overrides?.owner,
    short: String(overrides?.short ?? true),
    duration: asset.durationMs ? Math.round(asset.durationMs / 1000).toString() : undefined,
    thumbnail: overrides?.thumbnail,
  };

  if (overrides?.extra) {
    Object.assign(meta, overrides.extra);
  }

  return Object.entries(meta).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = sanitizeMetadataValue(String(value));
    return acc;
  }, {});
}

function parseAssetId(uploadUrl: string | null): string {
  if (!uploadUrl) {
    return '';
  }
  const parts = uploadUrl.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function extractPermlinkFromEmbedUrl(embedUrl: string): string | null {
  try {
    // embedUrl format: https://play.3speak.tv/embed?v=username/permlink
    const url = new URL(embedUrl);
    const vParam = url.searchParams.get('v');
    if (!vParam) return null;
    
    // Extract permlink from username/permlink
    const parts = vParam.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function uploadThumbnailToThreeSpeak(
  permlink: string,
  thumbnailUrl: string
): Promise<void> {
  const apiKey = ensureApiKeyPresent();
  
  const response = await fetch(`https://embed.3speak.tv/video/${permlink}/thumbnail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      thumbnail_url: thumbnailUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to upload thumbnail: ${response.status} ${errorText}`);
  }
}

export async function uploadVideoToThreeSpeak(
  params: UploadVideoToThreeSpeakParams
): Promise<ThreeSpeakUploadResult> {
  const apiKey = ensureApiKeyPresent();
  const { asset, metadata, onProgress, signal, chunkSize = DEFAULT_CHUNK_SIZE, retryDelays = DEFAULT_RETRY_DELAYS } = params;

  const fileSource = {
    uri: asset.uri,
    name: asset.filename,
    type: asset.mimeType,
  } as any;

  return new Promise<ThreeSpeakUploadResult>((resolve, reject) => {
    let aborted = false;
    let capturedEmbedUrl: string | null = null;

    const upload = new Upload(fileSource, {
      endpoint: THREE_SPEAK_UPLOAD_ENDPOINT,
      metadata: buildTusMetadata(asset, metadata),
      uploadSize: asset.sizeBytes,
      chunkSize,
      retryDelays,
      headers: {
        'X-API-Key': apiKey,
        'Tus-Resumable': '1.0.0',
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) {
          return;
        }
        const rawPercentage = (bytesUploaded / bytesTotal) * 100;
        const clampedPercentage = Math.min(100, Math.max(0, rawPercentage));
        onProgress?.({
          bytesUploaded,
          bytesTotal,
          percentage: Number(clampedPercentage.toFixed(2)),
        });
      },
      onAfterResponse: (req, res) => {
        const embedUrl = res.getHeader('X-Embed-URL');
        if (embedUrl) {
          capturedEmbedUrl = embedUrl;
        }
      },
      onError: (error: Error | DetailedError) => {
        cleanup();
        if (aborted) {
          reject(new Error('Upload aborted'));
          return;
        }
        reject(error);
      },
      onSuccess: () => {
        cleanup();
        if (!upload.url) {
          reject(new Error('3Speak upload completed without a Location URL.'));
          return;
        }
        if (!capturedEmbedUrl) {
          reject(new Error('3Speak upload completed without an X-Embed-URL header.'));
          return;
        }
        resolve({
          uploadUrl: upload.url,
          assetId: parseAssetId(upload.url),
          embedUrl: capturedEmbedUrl,
        });
      },
    });

    const handleAbort = () => {
      aborted = true;
      upload.abort(true).catch(() => {}).finally(() => {
        cleanup();
        reject(new Error('Upload aborted'));
      });
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort);
    }

    upload
      .findPreviousUploads()
      .then(previousUploads => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      })
      .catch(error => {
        cleanup();
        reject(error);
      });
  });
}
