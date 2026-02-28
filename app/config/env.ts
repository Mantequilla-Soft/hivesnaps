// env.ts
// Helper to get environment variables from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env - some API features may not work');
}

// THREE_SPEAK_API_KEY is required for video and audio upload features.
// It is optional for read-only operations (e.g., viewing videos/audio).
export const THREE_SPEAK_API_KEY = process.env.EXPO_PUBLIC_3SPEAK_API_KEY || '';
if (!THREE_SPEAK_API_KEY) {
  const message =
    '⚠️  THREE_SPEAK_API_KEY is not set in .env\n' +
    'Video and audio upload features will NOT work.\n' +
    'Set EXPO_PUBLIC_3SPEAK_API_KEY in your .env file to enable uploading.\n' +
    'Optionally, you can also set EXPO_PUBLIC_AUDIO_API_ENDPOINT for custom audio API endpoints.\n' +
    'Viewing videos and audio will still work normally.';

  if (__DEV__) {
    // In development, show clear warning but don't crash (allows testing read-only features)
    console.error(message);
  } else {
    console.warn(message);
  }
}

// AUDIO_API_ENDPOINT for 3Speak Audio API
export const AUDIO_API_ENDPOINT = process.env.EXPO_PUBLIC_AUDIO_API_ENDPOINT || 'https://audio.3speak.tv';

// IPFS endpoints for 3Speak
export const IPFS_UPLOAD_ENDPOINT = process.env.EXPO_PUBLIC_IPFS_UPLOAD_ENDPOINT || 'https://ipfs.3speak.tv/api/v0/add';
export const IPFS_GATEWAY_URL = process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL || 'https://ipfs.3speak.tv/ipfs';

// 3Speak Image Server Configuration
export const THREESPEAK_IMAGE_SERVER = process.env.EXPO_PUBLIC_THREESPEAK_IMAGE_SERVER || 'https://images.3speak.tv';
export const THREESPEAK_IMAGE_API_KEY = process.env.EXPO_PUBLIC_THREESPEAK_IMAGE_API_KEY || '';
if (!THREESPEAK_IMAGE_API_KEY && __DEV__) {
  console.warn('⚠️  THREESPEAK_IMAGE_API_KEY is not set - fallback image upload to 3Speak will not work');
}
