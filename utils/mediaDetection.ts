/**
 * Media Detection Utility
 * Detects and extracts audio and video embeds from snap content
 */

import { extractAudioPermlink } from '../services/audioUploadService';
import { SPEAK_AUDIO_URL_PATTERN, toSpeakAudioPlayerUrl } from './speakAudio';

export interface DetectedMedia {
  hasVideo: boolean;
  hasAudio: boolean;
  videoUrl: string | null;
  audioUrl: string | null;
  videoPermlink: string | null;
  audioPermlink: string | null;
  cleanBody: string; // Body without video/audio URLs
}

/**
 * Pattern for 3Speak video URLs
 * Matches: https://play.3speak.tv/...
 * Note: Using global flag for match() and replace() operations
 * Exported for use in other components that need to remove video URLs
 */
export const VIDEO_URL_PATTERN =
  /https?:\/\/(play\.)?3speak\.(tv|online)\/[^\s]+/gi;

/**
 * Pattern for 3Speak audio URLs: audio.3speak.tv/play?a= / ?list= / ?cid=,
 * and the 3speak.tv/audio?play= and 3speak.tv/playlist/ share links.
 * Note: Using global flag for match() and replace() operations
 * Exported for use in other components that need to remove audio URLs
 */
export const AUDIO_URL_PATTERN = SPEAK_AUDIO_URL_PATTERN;

/**
 * Detect and extract media from snap body content
 * @param body - The snap body text
 * @returns Detected media info and cleaned body
 */
export function detectMediaInBody(body: string): DetectedMedia {
  let cleanBody = body;
  let videoUrl: string | null = null;
  let audioUrl: string | null = null;
  let videoPermlink: string | null = null;
  let audioPermlink: string | null = null;

  // Extract audio URL first (first match only - one audio per snap): the
  // 3speak.tv/audio and /playlist share links would otherwise also match the
  // broad video pattern below. Share links become audio.3speak.tv player URLs.
  const audioMatches = cleanBody.match(AUDIO_URL_PATTERN);
  if (audioMatches && audioMatches.length > 0) {
    audioUrl = toSpeakAudioPlayerUrl(audioMatches[0]) ?? audioMatches[0];
    // Remove ALL audio URLs from body (only first is used, but clean up any extras)
    cleanBody = cleanBody.replace(AUDIO_URL_PATTERN, '').trim();

    // Extract audio permlink from URL
    audioPermlink = extractAudioPermlink(audioUrl);
  }

  // Extract video URL (first match only - one video per snap)
  const videoMatches = cleanBody.match(VIDEO_URL_PATTERN);
  if (videoMatches && videoMatches.length > 0) {
    videoUrl = videoMatches[0];
    // Remove ALL video URLs from body (only first is used, but clean up any extras)
    cleanBody = cleanBody.replace(VIDEO_URL_PATTERN, '').trim();
  }

  // Extract video permlink from URL (for consistency with audio)
  if (videoUrl) {
    videoPermlink = extractVideoPermlink(videoUrl);
  }

  return {
    hasVideo: !!videoUrl,
    hasAudio: !!audioUrl,
    videoUrl,
    audioUrl,
    videoPermlink,
    audioPermlink,
    cleanBody,
  };
}

/**
 * Extract video permlink from 3Speak URL
 * Attempts to extract the video identifier from various URL formats
 */
function extractVideoPermlink(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Try to get 'v' parameter first
    const vParam = urlObj.searchParams.get('v');
    if (vParam) return vParam;

    // Try to get 'p' parameter
    const pParam = urlObj.searchParams.get('p');
    if (pParam) return pParam;

    // Try to extract from path (last part)
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if body contains video embed
 * Note: Creates new RegExp to avoid lastIndex state issues with global flag
 */
export function hasVideoEmbed(body: string): boolean {
  const pattern = /https?:\/\/(play\.)?3speak\.(tv|online)\/[^\s]+/i;
  return pattern.test(body);
}

/**
 * Check if body contains audio embed
 * Note: Creates new RegExp to avoid lastIndex state issues with global flag
 */
export function hasAudioEmbed(body: string): boolean {
  const pattern = new RegExp(SPEAK_AUDIO_URL_PATTERN.source, 'i');
  return pattern.test(body);
}

/**
 * Remove video and audio URLs from body
 * Returns cleaned body text without media URLs
 */
export function removeMediaUrls(body: string): string {
  let cleaned = body;
  cleaned = cleaned.replace(VIDEO_URL_PATTERN, '').trim();
  cleaned = cleaned.replace(AUDIO_URL_PATTERN, '').trim();
  return cleaned;
}
