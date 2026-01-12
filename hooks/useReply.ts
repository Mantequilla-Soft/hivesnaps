import { useState, useCallback, useMemo } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { uploadImageSmart } from '../utils/imageUploadService';
import * as ImagePicker from 'expo-image-picker';
import { convertImageSmart } from '../utils/imageConverter';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export interface ReplyTarget {
  author: string;
  permlink: string;
}

interface ReplyState {
  replyModalVisible: boolean;
  replyText: string;
  replyImages: string[]; // Changed to array
  replyGifs: string[]; // Changed to array
  replyTarget: ReplyTarget | null;
  posting: boolean;
  uploading: boolean;
  processing: boolean; // New state for blockchain processing
  error: string | null;
}

interface UseReplyReturn extends ReplyState {
  openReplyModal: (target: ReplyTarget) => void;
  closeReplyModal: () => void;
  setReplyText: (text: string) => void;
  setReplyImages: (images: string[]) => void;
  setReplyGifs: (gifs: string[]) => void;
  addReplyImage: (imageUrl: string) => void;
  removeReplyImage: (imageUrl: string) => void;
  addReplyGif: (gifUrl: string) => void;
  removeReplyGif: (gifUrl: string) => void;
  submitReply: (overrides?: {
    target?: { author: string; permlink: string };
    text?: string;
    images?: string[];
    gifs?: string[];
    video?: string | null;
    audio?: string | null;
  }) => Promise<void>;
  addImage: (mode: 'reply') => Promise<void>;
  addGif: (gifUrl: string) => void;
  clearError: () => void;
}

export const useReply = (
  currentUsername: string | null,
  onRefresh?: () => Promise<boolean>,
  onSubmissionStart?: () => void
): UseReplyReturn => {
  const [state, setState] = useState<ReplyState>({
    replyModalVisible: false,
    replyText: '',
    replyImages: [], // Changed to array
    replyGifs: [], // Changed to array
    replyTarget: null,
    posting: false,
    uploading: false,
    processing: false,
    error: null,
  });

  const openReplyModal = useCallback((target: ReplyTarget) => {
    setState(prev => ({
      ...prev,
      replyTarget: target,
      replyModalVisible: true,
    }));
  }, []);

  const closeReplyModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      replyModalVisible: false,
      replyText: '',
      replyImages: [], // Changed to array
      replyGifs: [], // Changed to array
      replyTarget: null,
      error: null,
    }));
  }, []);

  const setReplyText = useCallback((text: string) => {
    setState(prev => ({ ...prev, replyText: text }));
  }, []);

  const setReplyImages = useCallback((images: string[]) => {
    setState(prev => ({ ...prev, replyImages: images }));
  }, []);

  const setReplyGifs = useCallback((gifs: string[]) => {
    setState(prev => ({ ...prev, replyGifs: gifs }));
  }, []);

  const addReplyImage = useCallback((imageUrl: string) => {
    setState(prev => ({ ...prev, replyImages: [...prev.replyImages, imageUrl] }));
  }, []);

  const removeReplyImage = useCallback((imageUrl: string) => {
    setState(prev => ({
      ...prev,
      replyImages: prev.replyImages.filter(img => img !== imageUrl)
    }));
  }, []);

  const addReplyGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, replyGifs: [...prev.replyGifs, gifUrl] }));
  }, []);

  const removeReplyGif = useCallback((gifUrl: string) => {
    setState(prev => ({
      ...prev,
      replyGifs: prev.replyGifs.filter(gif => gif !== gifUrl)
    }));
  }, []);

  const addImage = useCallback(async (mode: 'reply') => {
    if (mode !== 'reply') return;

    setState(prev => ({ ...prev, uploading: true }));

    try {
      // Use static import for ImagePicker
      const { launchImageLibraryAsync, MediaTypeOptions } = ImagePicker;

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // Smart conversion - only converts HEIC, preserves GIFs
        const converted = await convertImageSmart(asset.uri, asset.fileName, 0.8);

        const fileToUpload = {
          uri: converted.uri,
          name: converted.name,
          type: converted.type,
        };

        const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
        console.log(`[useReply] Image uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);

        // Add to array instead of replacing
        setState(prev => ({
          ...prev,
          replyImages: [...prev.replyImages, uploadResult.url]
        }));
      }
    } catch (error) {
      console.error('Image upload error:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to upload image',
      }));
    } finally {
      setState(prev => ({ ...prev, uploading: false }));
    }
  }, [currentUsername]);

  const addGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, replyGifs: [...prev.replyGifs, gifUrl] }));
  }, []);

  // submitReply now accepts optional override parameters to avoid async state timing issues
  const submitReply = useCallback(async (overrides?: {
    target?: { author: string; permlink: string };
    text?: string;
    images?: string[];
    gifs?: string[];
    video?: string | null; // 3speak video embed URL
    audio?: string | null; // 3speak audio embed URL
  }) => {
    // Use overrides if provided, otherwise fall back to state
    const target = overrides?.target || state.replyTarget;
    const text = overrides?.text ?? state.replyText;
    const images = overrides?.images ?? state.replyImages;
    const gifs = overrides?.gifs ?? state.replyGifs;
    const video = overrides?.video ?? null;
    const audio = overrides?.audio ?? null;

    // Validate and throw errors instead of silently returning
    if (!target) {
      const error = new Error('No reply target specified. Please try again.');
      setState(prev => ({ ...prev, error: error.message, posting: false }));
      throw error;
    }
    if (!text.trim() && images.length === 0 && gifs.length === 0 && !video && !audio) {
      const error = new Error('Reply cannot be empty. Please add text, images, GIFs, video, or audio.');
      setState(prev => ({ ...prev, error: error.message, posting: false }));
      throw error;
    }
    if (!currentUsername) {
      const error = new Error('Not logged in. Please log in to reply.');
      setState(prev => ({ ...prev, error: error.message, posting: false }));
      throw error;
    }

    setState(prev => ({ ...prev, posting: true, error: null }));

    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      let body = text.trim();

      // Add all images
      images.forEach(imageUrl => {
        body += `\n![image](${imageUrl})`;
      });

      // Add all GIFs
      gifs.forEach(gifUrl => {
        body += `\n![gif](${gifUrl})`;
      });

      // Add video embed URL if present
      if (video) {
        body += `\n${video}`;
      }

      // Add audio embed URL if present
      if (audio) {
        body += `\n${audio}`;
      }

      const parent_author = target.author;
      const parent_permlink = target.permlink;
      const author = currentUsername;

      // Sanitize parent_author for use in permlink
      const sanitizedParentAuthor = parent_author
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      const permlink = `re-${sanitizedParentAuthor}-${parent_permlink}-${Date.now()}`;

      const json_metadata: any = {
        app: 'hivesnaps/1.0',
        format: 'markdown',
        tags: ['hivesnaps', 'reply'],
      };

      // Add all images and GIFs to metadata
      const allMedia = [...images, ...gifs];
      if (allMedia.length > 0) {
        json_metadata.image = allMedia;
      }

      // Add video metadata if present
      if (video) {
        json_metadata.video = { platform: '3speak', url: video };
      }

      // Add audio metadata if present
      if (audio) {
        json_metadata.audio = { platform: '3speak', url: audio };
        // Note: Duration would be tracked separately when audio is uploaded
      }

      // Post to Hive blockchain
      await client.broadcast.comment(
        {
          parent_author,
          parent_permlink,
          author,
          permlink,
          title: '',
          body,
          json_metadata: JSON.stringify(json_metadata),
        },
        postingKey
      );

      // Close modal and reset state
      closeReplyModal();

      // Set processing state to true (keep posting true until we confirm success or timeout)
      setState(prev => ({ ...prev, processing: true }));

      // Notify that submission has started
      onSubmissionStart?.();

      // Add delay to account for Hive blockchain block time (3 seconds)
      setTimeout(() => {
        // Poll for new content every second for up to 4 retries
        let retryCount = 0;
        const maxRetries = 4;

        const pollForContent = () => {
          console.log(`Polling attempt ${retryCount + 1}/${maxRetries}`);
          onRefresh?.().then(contentFound => {
            if (contentFound) {
              console.log('Content found, stopping polling early');
              setState(prev => ({
                ...prev,
                processing: false,
                posting: false,
              })); // Clear both states
              return;
            }
            retryCount++;

            if (retryCount < maxRetries) {
              console.log(`Content not found, polling again in 1 second...`);
              setTimeout(pollForContent, 1000); // Poll again in 1 second
            } else {
              console.log('Max retries reached, stopping polling');
              setState(prev => ({
                ...prev,
                processing: false,
                posting: false,
              })); // Clear both states after timeout
            }
          });
        };

        pollForContent(); // Start polling
      }, 3000);
    } catch (error) {
      console.error('Reply submission error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to post reply',
        posting: false,
      }));
    }
  }, [
    state.replyTarget,
    state.replyText,
    state.replyImages,
    state.replyGifs,
    currentUsername,
    closeReplyModal,
    onRefresh,
    onSubmissionStart,
  ]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Memoize return object to prevent infinite loops when used in dependency arrays
  // This ensures the object reference only changes when actual state/callbacks change
  return useMemo(
    () => ({
      ...state,
      openReplyModal,
      closeReplyModal,
      setReplyText,
      setReplyImages,
      setReplyGifs,
      addReplyImage,
      removeReplyImage,
      addReplyGif,
      removeReplyGif,
      submitReply,
      addImage,
      addGif,
      clearError,
    }),
    [
      state,
      openReplyModal,
      closeReplyModal,
      setReplyText,
      setReplyImages,
      setReplyGifs,
      addReplyImage,
      removeReplyImage,
      addReplyGif,
      removeReplyGif,
      submitReply,
      addImage,
      addGif,
      clearError,
    ]
  );
};
