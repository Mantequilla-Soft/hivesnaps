import { useReducer, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
    generateVideoThumbnail,
    prepareLocalVideoAsset,
    uploadVideoToThreeSpeak,
    uploadThumbnailToThreeSpeak,
    extractPermlinkFromEmbedUrl,
    LocalVideoAsset,
    VideoThumbnail,
    VideoUploadProgress,
} from '../services/threeSpeakUploadService';
import { uploadImage, getHiveCredentials } from '../utils/imageUploadService';

// Video picker configuration
const MAX_VIDEO_DURATION_SECONDS = 120; // Business rule: 2-minute cap on video length
const GALLERY_PICKER_QUALITY = 1; // Maximum quality; compression is handled server-side

/**
 * Single state object for all video upload state
 * This ensures all 8 related state variables are managed together,
 * preventing the fragmentation bug where clearVideoState forgot some fields.
 */
interface VideoUploadState {
    asset: LocalVideoAsset | null;
    thumbnail: VideoThumbnail | null;
    thumbnailUrl: string | null;
    uploadProgress: VideoUploadProgress | null;
    uploading: boolean;
    error: string | null;
    assetId: string | null;
    uploadUrl: string | null;
}

type VideoUploadAction =
    | { type: 'SET_ASSET'; payload: { asset: LocalVideoAsset; thumbnail: VideoThumbnail | null } }
    | { type: 'UPLOAD_START'; payload: { totalBytes: number } }
    | { type: 'UPLOAD_PROGRESS'; payload: VideoUploadProgress }
    | { type: 'UPLOAD_SUCCESS'; payload: { assetId: string; uploadUrl: string } }
    | { type: 'UPLOAD_ERROR'; payload: string }
    | { type: 'THUMBNAIL_UPLOADED'; payload: string }
    | { type: 'CLEAR' };

const initialState: VideoUploadState = {
    asset: null,
    thumbnail: null,
    thumbnailUrl: null,
    uploadProgress: null,
    uploading: false,
    error: null,
    assetId: null,
    uploadUrl: null,
};

/**
 * Reducer ensures atomic state updates and prevents invalid state combinations.
 * All 8 state variables are guaranteed to be updated correctly together.
 */
function videoUploadReducer(state: VideoUploadState, action: VideoUploadAction): VideoUploadState {
    switch (action.type) {
        case 'SET_ASSET':
            return {
                ...state,
                asset: action.payload.asset,
                thumbnail: action.payload.thumbnail,
                error: null,
            };
        case 'UPLOAD_START':
            return {
                ...state,
                uploading: true,
                error: null,
                assetId: null,
                uploadUrl: null,
                uploadProgress: {
                    bytesUploaded: 0,
                    bytesTotal: action.payload.totalBytes,
                    percentage: 0,
                },
            };
        case 'UPLOAD_PROGRESS':
            return {
                ...state,
                uploadProgress: action.payload,
            };
        case 'UPLOAD_SUCCESS':
            return {
                ...state,
                uploading: false,
                assetId: action.payload.assetId,
                uploadUrl: action.payload.uploadUrl,
                uploadProgress: {
                    bytesUploaded: state.uploadProgress?.bytesTotal || 0,
                    bytesTotal: state.uploadProgress?.bytesTotal || 0,
                    percentage: 100,
                },
            };
        case 'UPLOAD_ERROR':
            return {
                ...state,
                uploading: false,
                error: action.payload,
                uploadProgress: null,
            };
        case 'THUMBNAIL_UPLOADED':
            return {
                ...state,
                thumbnailUrl: action.payload,
            };
        case 'CLEAR':
            // Single action clears ALL 8 state variables - impossible to forget one
            return initialState;
        default:
            return state;
    }
}

export function useVideoUpload(currentUsername: string | null) {
    const [state, dispatch] = useReducer(videoUploadReducer, initialState);
    const uploadControllerRef = useRef<AbortController | null>(null);
    const cancelRequestedRef = useRef(false);
    const thumbnailUploadPromiseRef = useRef<Promise<string | null> | null>(null);
    const thumbnailUploadControllerRef = useRef<AbortController | null>(null);

    // Store current state values in ref for stable callback access
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Cleanup on unmount: abort requests, clear refs, prevent memory leaks
    useEffect(() => {
        return () => {
            // Abort any ongoing uploads
            if (uploadControllerRef.current) {
                uploadControllerRef.current.abort();
            }
            if (thumbnailUploadControllerRef.current) {
                thumbnailUploadControllerRef.current.abort();
            }

            // Clear all refs
            uploadControllerRef.current = null;
            thumbnailUploadControllerRef.current = null;
            cancelRequestedRef.current = false;
            thumbnailUploadPromiseRef.current = null;
        };
    }, []);

    /**
     * Clear all video state atomically
     * This is guaranteed to reset all 8 state variables correctly
     */
    const clear = useCallback(() => {
        if (uploadControllerRef.current) {
            cancelRequestedRef.current = true;
            uploadControllerRef.current.abort();
        }
        if (thumbnailUploadControllerRef.current) {
            thumbnailUploadControllerRef.current.abort();
        }
        uploadControllerRef.current = null;
        thumbnailUploadControllerRef.current = null;
        cancelRequestedRef.current = false;
        thumbnailUploadPromiseRef.current = null;
        dispatch({ type: 'CLEAR' });
    }, []);

    /**
     * Start video upload process
     * Handles thumbnail generation, IPFS upload, and 3Speak upload
     */
    const startUpload = useCallback(async (asset: LocalVideoAsset) => {
        if (!currentUsername) {
            dispatch({ type: 'UPLOAD_ERROR', payload: 'You must be logged in to upload videos.' });
            return;
        }

        // Guard against concurrent calls
        if (stateRef.current.uploading) {
            if (__DEV__) console.warn('⚠️ Upload already in progress, ignoring concurrent call');
            return;
        }

        try {
            dispatch({ type: 'UPLOAD_START', payload: { totalBytes: asset.sizeBytes } });

            const controller = new AbortController();
            uploadControllerRef.current = controller;
            cancelRequestedRef.current = false;

            let maxPercentageSeen = 0;

            const result = await uploadVideoToThreeSpeak({
                asset,
                metadata: {
                    owner: currentUsername || undefined,
                },
                signal: controller.signal,
                onProgress: progress => {
                    // Only update if progress is moving forward
                    if (progress.percentage >= maxPercentageSeen) {
                        maxPercentageSeen = progress.percentage;
                        dispatch({ type: 'UPLOAD_PROGRESS', payload: progress });
                    }
                },
            });

            dispatch({
                type: 'UPLOAD_SUCCESS',
                payload: { assetId: result.embedUrl, uploadUrl: result.uploadUrl },
            });

            // Wait for thumbnail upload and set on 3Speak
            if (thumbnailUploadPromiseRef.current && result.embedUrl) {
                try {
                    if (__DEV__) console.log('⏳ Waiting for thumbnail upload to complete...');
                    const thumbnailUrl = await thumbnailUploadPromiseRef.current;

                    if (thumbnailUrl) {
                        if (__DEV__) console.log('✅ Thumbnail upload complete, setting on 3Speak...');
                        const permlink = extractPermlinkFromEmbedUrl(result.embedUrl);
                        if (permlink) {
                            await uploadThumbnailToThreeSpeak(permlink, thumbnailUrl);
                            if (__DEV__) console.log('✅ Thumbnail set on 3Speak for permlink:', permlink);
                        } else {
                            if (__DEV__) console.error('❌ Could not extract permlink from embedUrl:', result.embedUrl);
                        }
                    } else {
                        if (__DEV__) console.warn('⚠️ Thumbnail upload failed, skipping 3Speak thumbnail');
                    }
                } catch (thumbnailError) {
                    if (__DEV__) console.error('❌ Failed to set thumbnail on 3Speak:', thumbnailError);
                } finally {
                    // Always clear refs after completion/error
                    thumbnailUploadPromiseRef.current = null;
                    thumbnailUploadControllerRef.current = null;
                }
            } else {
                if (__DEV__) console.warn('⚠️ No thumbnail upload in progress');
            }
        } catch (error: any) {
            if (cancelRequestedRef.current) {
                dispatch({ type: 'CLEAR' });
            } else {
                if (__DEV__) console.error('3Speak video upload failed:', error);
                const message = error instanceof Error ? error.message : 'Failed to upload video. Please try again.';
                dispatch({ type: 'UPLOAD_ERROR', payload: message });
            }
        } finally {
            uploadControllerRef.current = null;
            thumbnailUploadControllerRef.current = null;
            cancelRequestedRef.current = false;
            thumbnailUploadPromiseRef.current = null;
        }
    }, [currentUsername]);

    /**
     * Add video from the given source (camera or gallery).
     * Source selection and confirmation dialogs are handled by the caller.
     */
    const addVideo = useCallback(async (source: 'camera' | 'gallery') => {
        try {
            // Silent guard — the button should be disabled in these states already
            if (stateRef.current.uploading) return;
            if (stateRef.current.asset || stateRef.current.assetId) return;

            let result: ImagePicker.ImagePickerResult;
            if (source === 'camera') {
                const currentPermission = await ImagePicker.getCameraPermissionsAsync();
                let finalStatus = currentPermission.status;
                if (finalStatus !== 'granted') {
                    const requestPermission = await ImagePicker.requestCameraPermissionsAsync();
                    finalStatus = requestPermission.status;
                }
                if (finalStatus !== 'granted') {
                    throw new Error('Camera access is required to record video. Please enable it in Settings > Privacy > Camera.');
                }

                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['videos'],
                    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
                    videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
                });
            } else {
                const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
                let finalStatus = currentPermission.status;
                if (finalStatus !== 'granted') {
                    const requestPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    finalStatus = requestPermission.status;
                }
                if (finalStatus !== 'granted') {
                    throw new Error('Photo library access is required to choose a video. Please enable it in Settings > Privacy > Photos.');
                }

                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['videos'],
                    allowsMultipleSelection: false,
                    quality: GALLERY_PICKER_QUALITY,
                });
            }

            if (!result || result.canceled || !result.assets?.length) return;

            const pickedVideo = result.assets[0];
            if (!pickedVideo?.uri) throw new Error('Unable to access selected video.');

            // Proactive check: expo-image-picker returns a ph:// URI (instead of file://)
            // when the video has not been downloaded from iCloud to the device.
            if (Platform.OS === 'ios' && !pickedVideo.uri.startsWith('file://')) {
                throw new Error(
                    'The selected video is not stored on your device. Please download it from iCloud first: Settings > Photos > Download and Keep Originals.'
                );
            }

            // Prepare the video asset; catch errors from prepareLocalVideoAsset that
            // indicate an iCloud-hosted file that was not fully available locally.
            let preparedAsset: LocalVideoAsset;
            try {
                preparedAsset = await prepareLocalVideoAsset(pickedVideo.uri, {
                    filename: pickedVideo.fileName || `snapie-video-${Date.now()}.mp4`,
                    mimeType: pickedVideo.mimeType || 'video/mp4',
                    durationMs: typeof pickedVideo.duration === 'number' ? Math.round(pickedVideo.duration * 1000) : undefined,
                });
            } catch (prepareError: any) {
                const errorMsg = prepareError?.message || String(prepareError);
                const isICloudError =
                    errorMsg.includes('PHPhotos') ||
                    errorMsg.includes('iCloud') ||
                    errorMsg.includes('no longer exists') ||
                    errorMsg.includes('size of 0 bytes');
                if (isICloudError) {
                    throw new Error(
                        'The selected video is not stored on your device. Please download it from iCloud first: Settings > Photos > Download and Keep Originals.'
                    );
                }
                throw prepareError;
            }

            let thumbnail: VideoThumbnail | null = null;
            try {
                thumbnail = await generateVideoThumbnail(pickedVideo.uri);

                // Start uploading thumbnail to images.hive.blog in parallel with video upload
                if (__DEV__) console.log('Starting thumbnail upload to images.hive.blog...');

                const thumbnailController = new AbortController();
                thumbnailUploadControllerRef.current = thumbnailController;


                thumbnailUploadPromiseRef.current = (async () => {
                    try {
                        if (!currentUsername) {
                            if (__DEV__) console.warn('⚠️ No username available, skipping thumbnail upload');
                            return null;
                        }

                        const credentials = await getHiveCredentials(currentUsername);
                        if (!credentials) {
                            if (__DEV__) console.warn('⚠️ No Hive credentials, skipping thumbnail upload');
                            return null;
                        }

                        const fileToUpload = {
                            uri: thumbnail.uri,
                            name: `video-thumbnail-${Date.now()}.jpg`,
                            type: 'image/jpeg',
                        };

                        const result = await uploadImage(fileToUpload, {
                            provider: 'hive',
                            username: credentials.username,
                            privateKey: credentials.privateKey,
                        });

                        const thumbnailUrl = result.url;
                        // Guard: don't dispatch into cleared state if upload was cancelled while in flight
                        if (thumbnailController.signal.aborted) return null;
                        dispatch({ type: 'THUMBNAIL_UPLOADED', payload: thumbnailUrl });
                        if (__DEV__) console.log('✅ Thumbnail uploaded to images.hive.blog:', thumbnailUrl);
                        return thumbnailUrl;
                    } catch (uploadError: any) {
                        // Don't log if it was cancelled
                        if (uploadError?.name !== 'AbortError') {
                            if (__DEV__) console.error('❌ Failed to upload thumbnail:', uploadError);
                        }
                        return null;
                    }
                })();
            } catch (thumbnailError: any) {
                // Handle thumbnail generation errors gracefully - don't fail if thumbnail fails
                const errorMsg = thumbnailError?.message || String(thumbnailError);
                console.warn('Failed to generate video thumbnail:', errorMsg);
                // Continue without thumbnail - it's not critical
            }

            dispatch({ type: 'SET_ASSET', payload: { asset: preparedAsset, thumbnail } });
            await startUpload(preparedAsset);
        } catch (error: any) {
            if (__DEV__) console.error('Video picker error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to add video. Please try again.';
            dispatch({ type: 'UPLOAD_ERROR', payload: errorMessage });
        }
    }, [currentUsername, startUpload]);

    /**
     * Cancel ongoing upload
     */
    const cancel = useCallback(() => {
        if (uploadControllerRef.current) {
            cancelRequestedRef.current = true;
            uploadControllerRef.current.abort();
        }
        if (thumbnailUploadControllerRef.current) {
            thumbnailUploadControllerRef.current.abort();
        }
    }, []);

    /**
     * Retry failed upload
     */
    const retry = useCallback(() => {
        // Guard against concurrent calls
        if (stateRef.current.uploading) {
            if (__DEV__) console.warn('⚠️ Upload already in progress, cannot retry');
            return;
        }
        if (stateRef.current.asset) {
            startUpload(stateRef.current.asset);
        }
    }, [startUpload]);

    /**
     * Remove video (or cancel an in-progress upload).
     * Confirmation dialog is the caller's responsibility.
     */
    const remove = useCallback(() => {
        const currentState = stateRef.current;
        if (!currentState.asset && !currentState.assetId) return;

        if (currentState.uploading) {
            if (uploadControllerRef.current) {
                cancelRequestedRef.current = true;
                uploadControllerRef.current.abort();
            }
            if (thumbnailUploadControllerRef.current) {
                thumbnailUploadControllerRef.current.abort();
            }
        } else {
            clear();
        }
    }, [clear]);

    return {
        // State
        asset: state.asset,
        thumbnail: state.thumbnail,
        thumbnailUrl: state.thumbnailUrl,
        uploadProgress: state.uploadProgress,
        uploading: state.uploading,
        error: state.error,
        assetId: state.assetId,
        uploadUrl: state.uploadUrl,
        // Computed
        hasVideo: !!(state.asset || state.assetId),
        videoEmbedUrl: state.assetId || null,
        // Actions
        addVideo,
        cancel,
        retry,
        remove,
        clear,
    };
}
