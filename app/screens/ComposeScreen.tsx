import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
  FlatList,
  Modal,
  ActionSheetIOS, // <-- statically import ActionSheetIOS
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import { Client, PrivateKey } from '@hiveio/dhive';
import { avatarService } from '../../services/AvatarService';
import { uploadImageSmart } from '../../utils/imageUploadService';
import { postSnapWithBeneficiaries } from '../../services/snapPostingService';
import { useSharedContent } from '../../hooks/useSharedContent';
import { uploadThumbnailToThreeSpeak, extractPermlinkFromEmbedUrl } from '../../services/threeSpeakUploadService';
import { uploadThumbnailToIPFS } from '../../utils/ipfsUpload';
import { useShare } from '../../context/ShareContext';
import { useGifPicker } from '../../hooks/useGifPickerV2';
import { GifPickerModal } from '../../components/GifPickerModalV2';
import { SnapData } from '../../hooks/useConversationData';
import Preview from '../components/Preview';
import { useReply } from '../../hooks/useReply';
import { useEdit } from '../../hooks/useEdit';
import { stripImageTags, getAllImageUrls } from '../../utils/extractImageInfo';
import {
  generateVideoThumbnail,
  prepareLocalVideoAsset,
  uploadVideoToThreeSpeak,
  LocalVideoAsset,
  VideoThumbnail,
  VideoUploadProgress,
} from '../../services/threeSpeakUploadService';
import { convertToJPEG, convertMultipleToJPEG } from '../../utils/imageConverter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export default function ComposeScreen() {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: 'compose' | 'reply' | 'edit';
    parentAuthor?: string;
    parentPermlink?: string;
    initialText?: string;
    resnapUrl?: string | string[];
  }>();

  // Determine the mode and related params
  const mode = params.mode || 'compose';
  const parentAuthor = params.parentAuthor;
  const parentPermlink = params.parentPermlink;
  const initialText = params.initialText;

  // Share extension integration
  const { sharedContent, hasSharedContent, clearSharedContent } =
    useSharedContent();
  const shareContext = useShare();

  // Component state
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Text selection state for markdown formatting
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const textInputRef = useRef<TextInput>(null);

  // Spoiler modal state
  const [spoilerModalVisible, setSpoilerModalVisible] = useState(false);
  const [spoilerButtonText, setSpoilerButtonText] = useState('');

  // Preview modal state
  const [previewVisible, setPreviewVisible] = useState(false);

  // GIF state for composer (array of GIF URLs)
  const [gifs, setGifs] = useState<string[]>([]);

  // Video upload state
  const [videoAsset, setVideoAsset] = useState<LocalVideoAsset | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<VideoThumbnail | null>(null);
  const [videoThumbnailIpfsUrl, setVideoThumbnailIpfsUrl] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<VideoUploadProgress | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string | null>(null);
  const videoUploadControllerRef = useRef<AbortController | null>(null);
  const videoCancelRequestedRef = useRef(false);
  const thumbnailIpfsUploadPromiseRef = useRef<Promise<string | null> | null>(null);

  // Track if reply/edit target has been initialized (refs are synchronous)
  const replyTargetRef = useRef<{ author: string; permlink: string } | null>(null);
  const editTargetRef = useRef<{ author: string; permlink: string } | null>(null);

  // Reply and edit hooks for modal-less operation
  // Note: Parent screens (ConversationScreen, HivePostScreen) should use useFocusEffect
  // to refresh their data when this screen navigates back
  const reply = useReply(
    currentUsername,
    undefined,
    undefined // We'll handle navigation after showing success alert
  );
  const edit = useEdit(
    currentUsername,
    undefined,
    undefined // We'll handle navigation after showing success alert
  );

  // Store reply/edit in refs to avoid stale closures in callbacks
  const replyRef = useRef(reply);
  const editRef = useRef(edit);
  useEffect(() => {
    replyRef.current = reply;
    editRef.current = edit;
  }, [reply, edit]);

  // Memoized GIF selection callback to prevent infinite re-render loop
  const handleGifSelected = useCallback((gifUrl: string) => {
    if (mode === 'reply') {
      replyRef.current.addReplyGif(gifUrl);
      setGifs(prev => [...prev, gifUrl]); // Also update local state for UI display
    } else if (mode === 'edit') {
      editRef.current.addEditGif(gifUrl);
      setGifs(prev => [...prev, gifUrl]); // Also update local state for UI display
    } else {
      setGifs(prev => [...prev, gifUrl]);
    }
  }, [mode]);

  // GIF picker state - using our new professional hook
  const gifPicker = useGifPicker({
    onGifSelected: handleGifSelected,
    // Remove loadTrendingOnOpen to use default (false)
    limit: 20,
  });

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    inputBg: isDark ? '#22303C' : '#F7F9F9',
    inputBorder: isDark ? '#38444D' : '#CFD9DE',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
    info: isDark ? '#8899A6' : '#536471',
  };

  // Computed video variables
  const videoEmbedUrl = videoAssetId || null;
  const hasPostableContent = Boolean(text.trim() || images.length > 0 || gifs.length > 0 || videoEmbedUrl);
  const isSubmitting = posting || reply.posting || edit.editing || videoUploading;
  const disablePostButton = isSubmitting || !hasPostableContent;
  const hasDraftContent = Boolean(
    text.trim() || images.length > 0 || gifs.length > 0 || videoAsset || videoAssetId || videoUploading
  );

  // Load user credentials and avatar
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);

        // Fetch user avatar (unified service)
        if (storedUsername) {
          const immediate =
            avatarService.getCachedAvatarUrl(storedUsername) ||
            `https://images.hive.blog/u/${storedUsername}/avatar/original`;
          setAvatarUrl(immediate);
          avatarService
            .getAvatarUrl(storedUsername)
            .then(({ url }) => {
              if (url) setAvatarUrl(url);
            })
            .catch(() => { });
        }
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();

    // Cleanup: abort any ongoing video upload when component unmounts
    return () => {
      if (videoUploadControllerRef.current) {
        console.log('[ComposeScreen] Unmounting - aborting video upload');
        videoCancelRequestedRef.current = true;
        videoUploadControllerRef.current.abort();
      }
    };
  }, []);

  // Handle shared content when component mounts or shared content changes
  useEffect(() => {
    if (hasSharedContent && sharedContent) {
      console.log('📱 ComposeScreen received shared content:', sharedContent);

      switch (sharedContent.type) {
        case 'text':
          if (typeof sharedContent.data === 'string') {
            setText(prev =>
              prev
                ? `${prev}\n\n${sharedContent.data}`
                : (sharedContent.data as string)
            );
          }
          break;

        case 'url':
          if (typeof sharedContent.data === 'string') {
            setText(prev =>
              prev
                ? `${prev}\n\n${sharedContent.data}`
                : (sharedContent.data as string)
            );
          }
          break;

        case 'image':
          if (typeof sharedContent.data === 'string') {
            setImages(prev => [...prev, sharedContent.data as string]);
          }
          break;

        case 'images':
          // For multiple images, add all of them
          if (Array.isArray(sharedContent.data)) {
            setImages(prev => [...prev, ...sharedContent.data]);
          }
          break;
      }

      // Clear shared content after processing
      clearSharedContent();
    }
  }, [sharedContent, hasSharedContent, clearSharedContent]);

  // Initialize reply/edit mode with content
  useEffect(() => {
    if (mode === 'reply' && parentAuthor && parentPermlink) {
      console.log('[ComposeScreen] Initializing reply mode for', parentAuthor, parentPermlink);

      // Store in ref for immediate synchronous access (React state is async)
      replyTargetRef.current = { author: parentAuthor, permlink: parentPermlink };

      // Also set hook state for submission
      reply.openReplyModal({ author: parentAuthor, permlink: parentPermlink });

      console.log('[ComposeScreen] Reply target ref set:', replyTargetRef.current);
    } else if (mode === 'edit' && parentAuthor && parentPermlink && initialText) {
      console.log('[ComposeScreen] Initializing edit mode for', parentAuthor, parentPermlink);
      const textBody = stripImageTags(initialText);
      const allUrls = getAllImageUrls(initialText);

      // Separate GIFs (Tenor/Giphy URLs) from regular images
      const gifUrls = allUrls.filter(url =>
        url.includes('tenor.com') ||
        url.includes('giphy.com') ||
        url.includes('media.tenor') ||
        url.includes('media.giphy')
      );
      const imageUrls = allUrls.filter(url =>
        !url.includes('tenor.com') &&
        !url.includes('giphy.com') &&
        !url.includes('media.tenor') &&
        !url.includes('media.giphy')
      );

      // Extract video embed URL (3speak format)
      const videoMatch = initialText.match(/https:\/\/3speak\.tv\/watch\?v=[^\s)]+/);
      const extractedVideo = videoMatch ? videoMatch[0] : null;

      // Set local text and media state for the compose screen
      setText(textBody);
      setImages(imageUrls);
      setGifs(gifUrls);
      if (extractedVideo) {
        setVideoAssetId(extractedVideo);
      }

      // Store in ref for immediate synchronous access
      editTargetRef.current = { author: parentAuthor, permlink: parentPermlink };

      // Also set edit hook state for submission
      edit.openEditModal(
        { author: parentAuthor, permlink: parentPermlink, type: 'snap' },
        initialText
      );

      console.log('[ComposeScreen] Edit target ref set:', editTargetRef.current);
    }
  }, [mode, parentAuthor, parentPermlink, initialText, reply, edit]);

  // Handle resnap URL parameter
  useEffect(() => {
    if (params.resnapUrl) {
      const resnapUrl = Array.isArray(params.resnapUrl)
        ? params.resnapUrl[0]
        : params.resnapUrl;

      if (typeof resnapUrl === 'string') {
        const newText = resnapUrl + '\n\n';
        setText(newText);

        // Focus the input and position cursor after URL and line breaks
        const timeoutId = setTimeout(() => {
          textInputRef.current?.focus();
          const cursorPosition = newText.length;
          textInputRef.current?.setSelection(cursorPosition, cursorPosition);
        }, 100);

        // Cleanup timeout if component unmounts
        return () => clearTimeout(timeoutId);
      }
    }
  }, [params.resnapUrl]);

  // Video upload handlers
  const clearVideoState = () => {
    setVideoAsset(null);
    setVideoThumbnail(null);
    setVideoUploadProgress(null);
    setVideoUploadError(null);
    setVideoAssetId(null);
    setVideoUploadUrl(null);
  };

  const startVideoUpload = async (asset: LocalVideoAsset) => {
    try {
      setVideoUploading(true);
      setVideoUploadError(null);
      setVideoAssetId(null);
      setVideoUploadUrl(null);
      setVideoUploadProgress({ bytesUploaded: 0, bytesTotal: asset.sizeBytes, percentage: 0 });

      const controller = new AbortController();
      videoUploadControllerRef.current = controller;
      videoCancelRequestedRef.current = false;

      let maxPercentageSeen = 0;

      const result = await uploadVideoToThreeSpeak({
        asset,
        metadata: {
          owner: currentUsername || undefined,
        },
        signal: controller.signal,
        onProgress: progress => {
          // Only update if progress is moving forward (prevents backtracking)
          if (progress.percentage >= maxPercentageSeen) {
            maxPercentageSeen = progress.percentage;
            setVideoUploadProgress(progress);
          }
        },
      });

      setVideoAssetId(result.embedUrl);
      setVideoUploadUrl(result.uploadUrl);
      setVideoUploadProgress({ bytesUploaded: asset.sizeBytes, bytesTotal: asset.sizeBytes, percentage: 100 });

      // Wait for thumbnail IPFS upload and set on 3Speak
      if (thumbnailIpfsUploadPromiseRef.current && result.embedUrl) {
        try {
          console.log('⏳ Waiting for thumbnail IPFS upload to complete...');
          const ipfsUrl = await thumbnailIpfsUploadPromiseRef.current;

          if (ipfsUrl) {
            console.log('✅ Thumbnail IPFS upload complete, setting on 3Speak...');
            const permlink = extractPermlinkFromEmbedUrl(result.embedUrl);
            if (permlink) {
              await uploadThumbnailToThreeSpeak(permlink, ipfsUrl);
              console.log('✅ Thumbnail set on 3Speak for permlink:', permlink);
            } else {
              console.error('❌ Could not extract permlink from embedUrl:', result.embedUrl);
            }
          } else {
            console.warn('⚠️ Thumbnail IPFS upload failed, skipping 3Speak thumbnail');
          }
        } catch (thumbnailError) {
          console.error('❌ Failed to set thumbnail on 3Speak:', thumbnailError);
        }
      } else {
        console.warn('⚠️ No thumbnail upload in progress');
      }
    } catch (error: any) {
      if (videoCancelRequestedRef.current) {
        clearVideoState();
      } else {
        console.error('3Speak video upload failed:', error);
        setVideoUploadError(error instanceof Error ? error.message : 'Failed to upload video. Please try again.');
      }
    } finally {
      setVideoUploading(false);
      videoUploadControllerRef.current = null;
      videoCancelRequestedRef.current = false;
    }
  };

  const handleRetryVideoUpload = () => {
    if (!videoAsset) return;
    startVideoUpload(videoAsset);
  };

  const handleRemoveVideo = () => {
    if (!videoAsset && !videoAssetId) return;

    Alert.alert(
      videoUploading ? 'Cancel Upload?' : 'Remove Video?',
      videoUploading ? 'Do you want to cancel this video upload?' : 'Remove the attached video from your snap?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: videoUploading ? 'Cancel Upload' : 'Remove',
          style: 'destructive',
          onPress: () => {
            if (videoUploading && videoUploadControllerRef.current) {
              videoCancelRequestedRef.current = true;
              videoUploadControllerRef.current.abort();
            } else {
              clearVideoState();
            }
          },
        },
      ]
    );
  };

  const handleAddVideo = async () => {
    try {
      if (videoUploading) {
        Alert.alert('Video Uploading', 'Please wait for the current video upload to finish.');
        return;
      }

      if (videoAsset || videoAssetId) {
        Alert.alert('Video Already Attached', 'Remove the current video before adding another one.');
        return;
      }

      let pickType: 'camera' | 'gallery' | 'cancel';

      if (Platform.OS === 'ios') {
        pickType = await new Promise(resolve => {
          ActionSheetIOS.showActionSheetWithOptions(
            { options: ['Cancel', 'Record Video', 'Choose from Library'], cancelButtonIndex: 0 },
            buttonIndex => {
              if (buttonIndex === 0) resolve('cancel');
              else if (buttonIndex === 1) resolve('camera');
              else resolve('gallery');
            }
          );
        });
      } else {
        pickType = await new Promise(resolve => {
          Alert.alert(
            'Add Video',
            'Choose a source',
            [
              { text: 'Record Video', onPress: () => resolve('camera') },
              { text: 'Choose from Library', onPress: () => resolve('gallery') },
              { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
            ],
            { cancelable: true }
          );
        });
      }

      if (pickType === 'cancel') return;

      let result: ImagePicker.ImagePickerResult;
      if (pickType === 'camera') {
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;
        if (finalStatus !== 'granted') {
          const requestPermission = await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        if (finalStatus !== 'granted') {
          Alert.alert('Camera Permission Required', 'HiveSnaps needs camera access to record video.');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
          videoMaxDuration: 120,
        });
      } else {
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;
        if (finalStatus !== 'granted') {
          const requestPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        if (finalStatus !== 'granted') {
          Alert.alert('Library Permission Required', 'HiveSnaps needs photo library access to choose a video.');
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsMultipleSelection: false,
          quality: 1,
        });
      }

      if (!result || result.canceled || !result.assets?.length) return;

      const pickedVideo = result.assets[0];
      if (!pickedVideo?.uri) throw new Error('Unable to access selected video.');

      const preparedAsset = await prepareLocalVideoAsset(pickedVideo.uri, {
        filename: pickedVideo.fileName || `snapie-video-${Date.now()}.mp4`,
        mimeType: pickedVideo.mimeType || 'video/mp4',
        durationMs: typeof pickedVideo.duration === 'number' ? Math.round(pickedVideo.duration * 1000) : undefined,
      });

      setVideoAsset(preparedAsset);
      setVideoUploadError(null);

      try {
        const thumbnailResult = await generateVideoThumbnail(pickedVideo.uri);
        setVideoThumbnail(thumbnailResult);

        // Start uploading thumbnail to IPFS in parallel with video upload
        console.log('Starting thumbnail upload to IPFS...');
        thumbnailIpfsUploadPromiseRef.current = (async () => {
          try {
            const ipfsUrl = await uploadThumbnailToIPFS(thumbnailResult.uri);
            setVideoThumbnailIpfsUrl(ipfsUrl);
            console.log('✅ Thumbnail uploaded to IPFS:', ipfsUrl);
            return ipfsUrl;
          } catch (ipfsError) {
            console.error('❌ Failed to upload thumbnail to IPFS:', ipfsError);
            return null;
          }
        })();
      } catch (thumbnailError) {
        console.warn('Failed to generate video thumbnail', thumbnailError);
        setVideoThumbnail(null);
      }

      await startVideoUpload(preparedAsset);
    } catch (error: any) {
      console.error('Video picker error:', error);
      Alert.alert('Video Error', error instanceof Error ? error.message : 'Failed to add video. Please try again.');
    }
  };

  const handleAddImage = async () => {
    try {
      let pickType: 'camera' | 'gallery' | 'cancel';

      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          // Use static import for ActionSheetIOS to avoid dynamic import issues
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
              cancelButtonIndex: 0,
            },
            buttonIndex => {
              if (buttonIndex === 0) resolve('cancel');
              else if (buttonIndex === 1) resolve('camera');
              else if (buttonIndex === 2) resolve('gallery');
            }
          );
        });
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
            Alert.alert(
              'Add Images',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                {
                  text: 'Choose from Gallery',
                  onPress: () => resolve('gallery'),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve('cancel'),
                },
              ],
              { cancelable: true }
            );
          }
        );
      }

      if (pickType === 'cancel') return;

      let result;
      if (pickType === 'camera') {
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          const requestPermission =
            await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
            [{ text: 'OK' }]
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        const currentPermission =
          await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          const requestPermission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Photo Library Permission Required',
            'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
            [{ text: 'OK' }]
          );
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false, // Allow multiple selection
          quality: 0.8,
          allowsMultipleSelection: true, // Enable multiple selection
          selectionLimit: 10, // Limit to 10 images
        });
      }

      if (
        !result ||
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      )
        return;

      setUploading(true);
      try {
        // Convert all HEIC and other formats to JPEG in parallel
        const convertedImages = await convertMultipleToJPEG(
          result.assets.map(asset => asset.uri),
          0.8
        );

        const uploadPromises = convertedImages.map(async (converted, index) => {
          const fileToUpload = {
            uri: converted.uri,
            name: `compose-${Date.now()}-${index}.jpg`,
            type: 'image/jpeg',
          };
          const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
          console.log(`[ComposeScreen] Image ${index + 1} uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
          return uploadResult.url;
        });

        const imageUrls = await Promise.all(uploadPromises);
        setImages(prev => [...prev, ...imageUrls]);
      } catch (err) {
        console.error('Image upload error:', err);
        Alert.alert(
          'Upload Failed',
          'Failed to upload one or more images. Please try again.'
        );
      } finally {
        setUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearAllImages = () => {
    setImages([]);
  };

  // GIF handlers - using new professional hook
  const handleOpenGifPicker = () => {
    gifPicker.openPicker();
  };

  const handleCloseGifModal = () => {
    gifPicker.closePicker();
  };

  const handleSearchGifs = async (query: string) => {
    await gifPicker.searchGifs(query);
  };

  const handleSelectGif = (gifUrl: string) => {
    // This is now handled by the hook's onGifSelected callback
    gifPicker.selectGif(gifUrl);
  };

  const handleRemoveGif = (indexToRemove: number) => {
    setGifs(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // ===== Submit Handlers =====

  const handleReplySubmit = async () => {
    if (!parentAuthor || !parentPermlink) {
      console.error('[ComposeScreen] Missing parent author or permlink for reply');
      Alert.alert('Error', 'Missing reply information. Please try again.');
      return;
    }

    if (!text.trim() && images.length === 0 && gifs.length === 0 && !videoEmbedUrl) {
      console.error('[ComposeScreen] Reply has no content');
      Alert.alert('Error', 'Please enter some text or add an image/GIF/video.');
      return;
    }

    console.log('[ComposeScreen] Submitting reply to', parentAuthor, parentPermlink);
    console.log('[ComposeScreen] Reply content:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      images: images.length,
      gifs: gifs.length,
      video: videoEmbedUrl ? 'yes' : 'no',
    });

    // Submit reply - pass values directly to avoid async state timing issues
    try {
      await reply.submitReply({
        target: { author: parentAuthor, permlink: parentPermlink },
        text: text,
        images: images,
        gifs: gifs,
        video: videoEmbedUrl,
      });
      console.log('[ComposeScreen] Reply submission completed successfully');

      // Success - clear form and show success alert
      setText('');
      setImages([]);
      setGifs([]);
      clearVideoState();
      replyTargetRef.current = null;

      Alert.alert(
        'Reply Posted!',
        'Your reply has been published to the Hive blockchain.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('[ComposeScreen] Reply submitted, navigating back');
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('[ComposeScreen] Reply submission exception:', error);
      Alert.alert('Reply Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handleEditSubmit = async () => {
    if (!parentAuthor || !parentPermlink) {
      console.error('[ComposeScreen] Missing parent author or permlink for edit');
      Alert.alert('Error', 'Missing edit information. Please try again.');
      return;
    }

    if (!text.trim() && images.length === 0 && gifs.length === 0 && !videoEmbedUrl) {
      console.error('[ComposeScreen] Edit has no content');
      Alert.alert('Error', 'Please enter some text or add an image/GIF/video.');
      return;
    }

    console.log('[ComposeScreen] Submitting edit for', parentAuthor, parentPermlink);
    console.log('[ComposeScreen] Edit content:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      images: images.length,
      gifs: gifs.length,
      video: videoEmbedUrl ? 'yes' : 'no',
    });

    // Submit edit - pass values directly to avoid async state timing issues
    try {
      await edit.submitEdit({
        target: { author: parentAuthor, permlink: parentPermlink },
        text: text,
        images: images,
        gifs: gifs,
        video: videoEmbedUrl,
      });
      console.log('[ComposeScreen] Edit submission completed successfully');

      // Success - clear form state and show success alert
      setText('');
      setImages([]);
      setGifs([]);
      clearVideoState();
      editTargetRef.current = null;

      Alert.alert(
        'Edit Saved!',
        'Your changes have been published to the Hive blockchain.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('[ComposeScreen] Edit submitted, navigating back');
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('[ComposeScreen] Edit submission exception:', error);
      Alert.alert('Edit Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handleSubmit = async () => {
    // Route to appropriate submit handler based on mode
    if (mode === 'reply') {
      await handleReplySubmit();
      return;
    } else if (mode === 'edit') {
      await handleEditSubmit();
      return;
    }

    // Original compose logic
    if (videoUploading) {
      Alert.alert('Video Uploading', 'Please wait for the video upload to finish.');
      return;
    }

    if (!hasPostableContent) {
      Alert.alert('Empty Post', 'Please add text, images, GIFs, or a video before posting.');
      return;
    }

    if (videoAsset && !videoAssetId) {
      Alert.alert('Video Not Ready', 'Finish uploading or remove the video before posting.');
      return;
    }

    if (!currentUsername) {
      Alert.alert('Not Logged In', 'Please log in to post to Hive.');
      return;
    }

    setPosting(true);

    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Compose body
      let body = text.trim();
      if (images.length > 0) {
        // Add all images to the body
        images.forEach((imageUrl, index) => {
          body += `\n![image${index + 1}](${imageUrl})`;
        });
      }
      if (gifs.length > 0) {
        // Add all GIFs to the body
        gifs.forEach((gifUrl, index) => {
          body += `\n![gif${index + 1}](${gifUrl})`;
        });
      }
      if (videoEmbedUrl) {
        body += `\n${videoEmbedUrl}`;
      }

      // Get latest @peak.snaps post (container) - Same as FeedScreen
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [{ tag: 'peak.snaps', limit: 1 }]
      );
      if (!discussions || discussions.length === 0) {
        throw new Error('No container post found.');
      }
      const container = discussions[0];

      // Generate permlink - Same format as FeedScreen
      const permlink = `snap-${Date.now()}`;

      // Compose metadata - Same format as FeedScreen
      const allMedia = [...images, ...gifs];
      const json_metadata = JSON.stringify({
        app: 'hivesnaps/1.0',
        tags: ['hive-178315', 'snaps'],
        image: allMedia, // Include all images and GIFs in metadata
        video: videoEmbedUrl ? { platform: '3speak', url: videoEmbedUrl, uploadUrl: videoUploadUrl } : undefined,
        shared: hasSharedContent, // Additional flag for shared content
      });

      // Post to Hive blockchain as reply to container with beneficiaries if video is present
      await postSnapWithBeneficiaries(
        client,
        {
          parentAuthor: container.author,
          parentPermlink: container.permlink,
          author: currentUsername,
          permlink,
          title: '',
          body,
          jsonMetadata: json_metadata,
          hasVideo: !!videoEmbedUrl, // Add beneficiaries if there's a video
        },
        postingKey
      );

      // Success - clear form and navigate back to feed
      setText('');
      setImages([]);
      setGifs([]);
      clearVideoState();
      clearSharedContent(); // Clear any shared content

      Alert.alert(
        'Posted Successfully!',
        'Your snap has been published to the Hive blockchain.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/screens/FeedScreen');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error posting snap:', error);
      Alert.alert(
        'Post Failed',
        error.message || 'Failed to post snap. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = () => {
    if (hasDraftContent) {
      Alert.alert(
        'Discard Post?',
        'Are you sure you want to discard this post?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setText('');
              setImages([]);
              setGifs([]);
              if (videoUploadControllerRef.current) {
                videoCancelRequestedRef.current = true;
                videoUploadControllerRef.current.abort();
              }
              clearVideoState();
              setVideoUploading(false);
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Markdown formatting functions
  const insertMarkdown = (
    before: string,
    after: string,
    placeholder: string
  ) => {
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection) {
      // Wrap selected text
      const beforeText = text.substring(0, selectionStart);
      const selectedText = text.substring(selectionStart, selectionEnd);
      const afterText = text.substring(selectionEnd);

      const newText = beforeText + before + selectedText + after + afterText;
      setText(newText);

      // Position cursor after the formatted text
      const newCursorPosition =
        selectionStart + before.length + selectedText.length + after.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition },
        });
      }, 10);
    } else {
      // Insert with placeholder and select it
      const beforeText = text.substring(0, selectionStart);
      const afterText = text.substring(selectionStart);

      const newText = beforeText + before + placeholder + after + afterText;
      setText(newText);

      // Select the placeholder text for easy replacement
      const placeholderStart = selectionStart + before.length;
      const placeholderEnd = placeholderStart + placeholder.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: placeholderStart, end: placeholderEnd },
        });
      }, 10);
    }
  };

  const handleBold = () => {
    insertMarkdown('**', '**', 'bold text');
  };

  const handleItalic = () => {
    insertMarkdown('*', '*', 'italic text');
  };

  const handleUnderline = () => {
    insertMarkdown('<u>', '</u>', 'underlined text');
  };

  const handleSpoiler = () => {
    setSpoilerButtonText('');
    setSpoilerModalVisible(true);
  };

  const handleSpoilerConfirm = () => {
    const buttonText = spoilerButtonText.trim() || 'button text';
    const spoilerSyntax = `>! [${buttonText}] spoiler content`;

    const beforeText = text.substring(0, selectionStart);
    const afterText = text.substring(selectionStart);
    const newText = beforeText + spoilerSyntax + afterText;
    setText(newText);

    // Position cursor after "spoiler content" and select it for easy replacement
    const contentStart = selectionStart + `>! [${buttonText}] `.length;
    const contentEnd = contentStart + 'spoiler content'.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: contentStart, end: contentEnd },
      });
    }, 10);

    setSpoilerModalVisible(false);
    setSpoilerButtonText('');
  };

  const handleSelectionChange = (event: any) => {
    const { start, end } = event.nativeEvent.selection;
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  // Create preview SnapData from current compose state
  const createPreviewSnapData = (): SnapData => {
    // Process body same way as in handleSubmit
    let body = text.trim();
    if (images.length > 0) {
      images.forEach((imageUrl, index) => {
        body += `\n![image${index + 1}](${imageUrl})`;
      });
    }
    if (gifs.length > 0) {
      gifs.forEach((gifUrl, index) => {
        body += `\n![gif${index + 1}](${gifUrl})`;
      });
    }
    if (videoEmbedUrl) {
      body += `\n${videoEmbedUrl}`;
    }

    return {
      author: currentUsername || 'preview-user',
      avatarUrl: avatarUrl || undefined,
      body: body,
      created: new Date().toISOString().slice(0, -1), // Remove 'Z' to match Hive format
      voteCount: 0,
      replyCount: 0,
      payout: 0,
      permlink: `preview-${Date.now()}`,
      hasUpvoted: false,
      active_votes: [],
      json_metadata: undefined,
      posting_json_metadata: undefined,
      parent_author: undefined,
      parent_permlink: undefined,
      community: undefined,
    };
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.inputBorder }]}
        >
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {mode === 'reply'
                ? 'Reply'
                : mode === 'edit'
                  ? 'Edit Snap'
                  : 'New Snap'}
            </Text>
            {mode === 'reply' && parentAuthor && parentAuthor !== 'peak.snaps' && (
              <Text style={[styles.headerSubtitle, { color: colors.info }]}>
                @{parentAuthor}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={disablePostButton}
            style={[
              styles.headerButton,
              styles.postButton,
              {
                backgroundColor: disablePostButton
                  ? colors.buttonInactive
                  : colors.button,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size='small' color={colors.buttonText} />
            ) : (
              <Text
                style={[styles.headerButtonText, { color: colors.buttonText }]}
              >
                {mode === 'edit' ? 'Save' : 'Post'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User info */}
          <View style={styles.userRow}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onError={() => setAvatarUrl(null)}
              />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: colors.inputBg }]}
              >
                <FontAwesome name='user' size={20} color={colors.info} />
              </View>
            )}
            <Text style={[styles.username, { color: colors.text }]}>
              {currentUsername || 'Anonymous'}
            </Text>
          </View>

          {/* Test Share Function (Development Only) */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <Text style={[styles.sectionTitle, { color: colors.info }]}>
                🧪 Test Share Functionality
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'text',
                      data: 'This is a test shared text! 🚀',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Text
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'url',
                      data: 'https://hive.blog',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share URL
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'image',
                      data: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Image
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'images',
                      data: [
                        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
                        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500',
                      ],
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Multiple
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Text input */}
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.inputBorder,
              },
            ]}
            value={text}
            onChangeText={setText}
            onSelectionChange={handleSelectionChange}
            placeholder="What's happening?"
            placeholderTextColor={colors.info}
            multiline
            textAlignVertical='top'
            maxLength={280}
          />

          {/* Character count */}
          <View style={styles.charCountRow}>
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    text.length > 260
                      ? '#e74c3c'
                      : text.length > 240
                        ? '#f39c12'
                        : colors.info,
                },
              ]}
            >
              {text.length}/280
            </Text>
          </View>

          {/* Images preview */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  {images.length} image{images.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.clearAllButton,
                    { backgroundColor: colors.buttonInactive },
                  ]}
                  onPress={handleClearAllImages}
                >
                  <Text style={[styles.clearAllText, { color: colors.text }]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagesScrollView}
                contentContainerStyle={styles.imagesScrollContent}
              >
                {images.map((imageUrl, index) => (
                  <View
                    key={`${imageUrl}-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <FontAwesome name='times' size={16} color='#fff' />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* GIF Previews */}
          {gifs.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  GIFs ({gifs.length})
                </Text>
                {gifs.length > 1 && (
                  <TouchableOpacity onPress={() => setGifs([])}>
                    <Text style={[styles.clearAllText, { color: colors.info }]}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagesScrollView}
                contentContainerStyle={styles.imagesScrollContent}
              >
                {gifs.map((gifUrl, index) => (
                  <View
                    key={`gif-${gifUrl}-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: gifUrl }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveGif(index)}
                    >
                      <FontAwesome name='times' size={16} color='#fff' />
                    </TouchableOpacity>
                    {/* GIF badge */}
                    <View style={styles.gifBadge}>
                      <Text style={styles.gifBadgeText}>GIF</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Video Preview */}
          {(videoAsset || videoAssetId || videoUploading || videoUploadError) && (
            <View style={[styles.imagesContainer, { paddingVertical: 12 }]}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  Video
                </Text>
                {!videoUploading && (
                  <TouchableOpacity onPress={handleRemoveVideo}>
                    <Text style={[styles.clearAllText, { color: colors.info }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: colors.inputBg,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: videoUploadError ? '#ff3b30' : colors.inputBorder
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {videoThumbnail ? (
                    <Image
                      source={{ uri: videoThumbnail.uri }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 6,
                        marginRight: 12
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{
                      width: 60,
                      height: 60,
                      borderRadius: 6,
                      marginRight: 12,
                      backgroundColor: colors.inputBorder,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FontAwesome name="video-camera" size={24} color={colors.text} />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}
                      numberOfLines={1}
                    >
                      {videoAsset?.filename || 'Video'}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
                      {videoAsset?.sizeBytes && (
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          backgroundColor: colors.inputBorder,
                          borderRadius: 4,
                          marginRight: 6,
                          marginTop: 2
                        }}>
                          <Text style={{ color: colors.text, fontSize: 11 }}>
                            {(videoAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </Text>
                        </View>
                      )}
                      {videoAsset?.durationMs && (
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          backgroundColor: colors.inputBorder,
                          borderRadius: 4,
                          marginTop: 2
                        }}>
                          <Text style={{ color: colors.text, fontSize: 11 }}>
                            {Math.floor(videoAsset.durationMs / 60000)}:{String(Math.floor((videoAsset.durationMs % 60000) / 1000)).padStart(2, '0')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {videoUploading && videoUploadProgress && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: colors.text, fontSize: 12 }}>
                        Uploading...
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 12 }}>
                        {videoUploadProgress.percentage}%
                      </Text>
                    </View>
                    <View style={{
                      height: 4,
                      backgroundColor: colors.inputBorder,
                      borderRadius: 2,
                      overflow: 'hidden'
                    }}>
                      <View style={{
                        height: 4,
                        width: `${videoUploadProgress.percentage}%`,
                        backgroundColor: colors.button,
                      }} />
                    </View>
                  </View>
                )}

                {videoUploadError && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: '#ff3b30', fontSize: 12, marginBottom: 8 }}>
                      {videoUploadError}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      <TouchableOpacity
                        onPress={handleRetryVideoUpload}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          backgroundColor: colors.button,
                          borderRadius: 6,
                          marginRight: 8
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
                          Retry
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleRemoveVideo}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          backgroundColor: colors.inputBorder,
                          borderRadius: 6
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '500' }}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {videoAssetId && !videoUploading && !videoUploadError && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: '#34c759', fontSize: 12, fontWeight: '500' }}>
                      ✓ Video ready to post
                    </Text>
                  </View>
                )}
              </View>

              {(videoAsset || videoAssetId) && (
                <Text style={{
                  fontSize: 11,
                  color: colors.text,
                  opacity: 0.6,
                  marginTop: 8
                }}>
                  One video per snap • Max 100 MB
                </Text>
              )}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Markdown formatting toolbar */}
            <View style={styles.markdownToolbar}>
              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleBold}
              >
                <FontAwesome name='bold' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleItalic}
              >
                <FontAwesome name='italic' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleUnderline}
              >
                <FontAwesome name='underline' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleSpoiler}
              >
                <FontAwesome name='eye-slash' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setPreviewVisible(true)}
                disabled={!text.trim() && images.length === 0 && gifs.length === 0}
              >
                <FontAwesome
                  name='eye'
                  size={16}
                  color={(!text.trim() && images.length === 0 && gifs.length === 0) ? colors.info : colors.button}
                />
              </TouchableOpacity>
            </View>

            {/* Image and GIF buttons */}
            <View style={styles.mediaButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleAddImage}
                disabled={uploading || images.length >= 10}
              >
                {uploading ? (
                  <ActivityIndicator size='small' color={colors.button} />
                ) : (
                  <>
                    <FontAwesome
                      name='image'
                      size={20}
                      color={images.length >= 10 ? colors.info : colors.button}
                    />
                    {images.length > 0 && (
                      <View
                        style={[
                          styles.imageBadge,
                          { backgroundColor: colors.button },
                        ]}
                      >
                        <Text style={styles.imageBadgeText}>
                          {images.length}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg, marginLeft: 12 },
                ]}
                onPress={handleOpenGifPicker}
                disabled={gifs.length >= 5}
              >
                <Text
                  style={{
                    fontSize: 18,
                    color: gifs.length >= 5 ? colors.info : colors.button,
                    fontWeight: 'bold',
                  }}
                >
                  GIF
                </Text>
                {gifs.length > 0 && (
                  <View
                    style={[
                      styles.imageBadge,
                      { backgroundColor: colors.button },
                    ]}
                  >
                    <Text style={styles.imageBadgeText}>{gifs.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg, marginLeft: 12 },
                ]}
                onPress={handleAddVideo}
                disabled={videoAsset !== null || videoAssetId !== null || videoUploading}
              >
                <FontAwesome
                  name="video-camera"
                  size={20}
                  color={(videoAsset || videoAssetId || videoUploading) ? colors.info : colors.button}
                />
                {(videoAsset || videoAssetId) && (
                  <View
                    style={[
                      styles.imageBadge,
                      { backgroundColor: colors.button },
                    ]}
                  >
                    <Text style={styles.imageBadgeText}>1</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {images.length >= 10 && (
              <Text style={[styles.limitText, { color: colors.info }]}>
                Maximum 10 images
              </Text>
            )}
            {gifs.length >= 5 && (
              <Text style={[styles.limitText, { color: colors.info }]}>
                Maximum 5 GIFs
              </Text>
            )}
          </View>

          {/* Shared content indicator */}
          {hasSharedContent && (
            <View
              style={[
                styles.sharedIndicator,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <FontAwesome name='share' size={16} color={colors.button} />
              <Text style={[styles.sharedText, { color: colors.info }]}>
                Content shared from another app
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Professional GIF Picker Modal */}
      <GifPickerModal
        visible={gifPicker.state.modalVisible}
        onClose={gifPicker.closePicker}
        onSelectGif={gifPicker.selectGif}
        searchQuery={gifPicker.state.searchQuery}
        onSearchQueryChange={gifPicker.setSearchQuery}
        onSearchSubmit={gifPicker.searchGifs}
        gifResults={gifPicker.state.results}
        loading={gifPicker.state.loading}
        error={gifPicker.state.error}
        colors={{
          background: colors.background,
          text: colors.text,
          inputBg: colors.inputBg,
          inputBorder: colors.inputBorder,
          button: colors.button,
        }}
      />

      {/* Spoiler Modal */}
      <Modal
        visible={spoilerModalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setSpoilerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.spoilerModal,
              {
                backgroundColor: colors.background,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <Text style={[styles.spoilerModalTitle, { color: colors.text }]}>
              Add Spoiler
            </Text>

            <Text
              style={[styles.spoilerModalDescription, { color: colors.info }]}
            >
              Enter the text that will appear on the spoiler button:
            </Text>

            <TextInput
              style={[
                styles.spoilerInput,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                },
              ]}
              value={spoilerButtonText}
              onChangeText={setSpoilerButtonText}
              placeholder='button text'
              placeholderTextColor={colors.info}
              maxLength={50}
              autoFocus
            />

            <View style={styles.spoilerModalButtons}>
              <TouchableOpacity
                style={[
                  styles.spoilerModalButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setSpoilerModalVisible(false)}
              >
                <Text
                  style={[
                    styles.spoilerModalButtonText,
                    { color: colors.text },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.spoilerModalButton,
                  { backgroundColor: colors.button },
                ]}
                onPress={handleSpoilerConfirm}
              >
                <Text
                  style={[
                    styles.spoilerModalButtonText,
                    { color: colors.buttonText },
                  ]}
                >
                  Add Spoiler
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Preview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        snapData={createPreviewSnapData()}
        currentUsername={currentUsername}
        colors={{
          background: colors.background,
          text: colors.text,
          inputBorder: colors.inputBorder,
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postButton: {
    // Additional styles for post button
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    fontSize: 18,
    lineHeight: 24,
    minHeight: 120,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  charCount: {
    fontSize: 14,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imagesCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagesScrollView: {
    marginHorizontal: -8,
  },
  imagesScrollContent: {
    paddingHorizontal: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
    width: 120,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  markdownToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  markdownButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  imageBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  gifBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  limitText: {
    fontSize: 12,
    marginLeft: 8,
  },
  sharedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sharedText: {
    marginLeft: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  devSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffa500',
    borderStyle: 'dashed',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notificationStatus: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  // Spoiler modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spoilerModal: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  spoilerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  spoilerModalDescription: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  spoilerInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  spoilerModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  spoilerModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  spoilerModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
