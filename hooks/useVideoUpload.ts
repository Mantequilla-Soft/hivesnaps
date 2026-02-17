import { useReducer, useRef, useCallback, useEffect } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
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
    const isMountedRef = useRef(true);

    // Cleanup on unmount: abort requests, clear refs, prevent memory leaks
    useEffect(() => {
        return () => {
            // Mark component as unmounted
            isMountedRef.current = false;

            // Abort any ongoing upload
            if (uploadControllerRef.current) {
                uploadControllerRef.current.abort();
            }

            // Clear all refs
            uploadControllerRef.current = null;
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
        uploadControllerRef.current = null;
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
            Alert.alert('Error', 'You must be logged in to upload videos');
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
                    // Only update if progress is moving forward and component is mounted
                    if (isMountedRef.current && progress.percentage >= maxPercentageSeen) {
                        maxPercentageSeen = progress.percentage;
                        dispatch({ type: 'UPLOAD_PROGRESS', payload: progress });
                    }
                },
            });

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            dispatch({
                type: 'UPLOAD_SUCCESS',
                payload: { assetId: result.embedUrl, uploadUrl: result.uploadUrl },
            });

            // Wait for thumbnail upload and set on 3Speak
            if (thumbnailUploadPromiseRef.current && result.embedUrl) {
                try {
                    if (__DEV__) console.log('⏳ Waiting for thumbnail upload to complete...');
                    const thumbnailUrl = await thumbnailUploadPromiseRef.current;

                    // Check if still mounted before making API call
                    if (!isMountedRef.current) return;

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
                    // Always clear promise reference after completion/error
                    thumbnailUploadPromiseRef.current = null;
                }
            } else {
                if (__DEV__) console.warn('⚠️ No thumbnail upload in progress');
            }
        } catch (error: any) {
            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            if (cancelRequestedRef.current) {
                dispatch({ type: 'CLEAR' });
            } else {
                if (__DEV__) console.error('3Speak video upload failed:', error);
                const message = error instanceof Error ? error.message : 'Failed to upload video. Please try again.';
                dispatch({ type: 'UPLOAD_ERROR', payload: message });
            }
        } finally {
            uploadControllerRef.current = null;
            cancelRequestedRef.current = false;
            thumbnailUploadPromiseRef.current = null;
        }
    }, [currentUsername]);

    /**
     * Add video from camera or gallery with UI picker
     */
    const addVideo = useCallback(async () => {
        try {
            if (state.uploading) {
                Alert.alert('Video Uploading', 'Please wait for the current video upload to finish.');
                return;
            }

            if (state.asset || state.assetId) {
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

            let thumbnail: VideoThumbnail | null = null;
            try {
                thumbnail = await generateVideoThumbnail(pickedVideo.uri);

                // Start uploading thumbnail to images.hive.blog in parallel with video upload
                if (__DEV__) console.log('Starting thumbnail upload to images.hive.blog...');
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
                            fallbackToCloudinary: false,
                        });

                        const thumbnailUrl = result.url;
                        // Only update state if component is still mounted
                        if (isMountedRef.current) {
                            dispatch({ type: 'THUMBNAIL_UPLOADED', payload: thumbnailUrl });
                            if (__DEV__) console.log('✅ Thumbnail uploaded to images.hive.blog:', thumbnailUrl);
                        }
                        return thumbnailUrl;
                    } catch (uploadError) {
                        if (__DEV__) console.error('❌ Failed to upload thumbnail:', uploadError);
                        return null;
                    }
                })();
            } catch (thumbnailError) {
                console.warn('Failed to generate video thumbnail', thumbnailError);
            }

            dispatch({ type: 'SET_ASSET', payload: { asset: preparedAsset, thumbnail } });
            await startUpload(preparedAsset);
        } catch (error: any) {
            console.error('Video picker error:', error);
            Alert.alert('Video Error', error instanceof Error ? error.message : 'Failed to add video. Please try again.');
        }
    }, [state.uploading, state.asset, state.assetId, startUpload]);

    /**
     * Cancel ongoing upload
     */
    const cancel = useCallback(() => {
        if (uploadControllerRef.current) {
            cancelRequestedRef.current = true;
            uploadControllerRef.current.abort();
        }
    }, []);

    /**
     * Retry failed upload
     */
    const retry = useCallback(() => {
        if (state.asset) {
            startUpload(state.asset);
        }
    }, [state.asset, startUpload]);

    /**
     * Remove video with confirmation
     */
    const remove = useCallback(() => {
        if (!state.asset && !state.assetId) return;

        Alert.alert(
            state.uploading ? 'Cancel Upload?' : 'Remove Video?',
            state.uploading ? 'Do you want to cancel this video upload?' : 'Remove the attached video from your snap?',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: state.uploading ? 'Cancel Upload' : 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        if (state.uploading && uploadControllerRef.current) {
                            cancelRequestedRef.current = true;
                            uploadControllerRef.current.abort();
                        } else {
                            clear();
                        }
                    },
                },
            ]
        );
    }, [state.uploading, state.asset, state.assetId, clear]);

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
        startUpload,
        cancel,
        retry,
        remove,
        clear,
    };
}
