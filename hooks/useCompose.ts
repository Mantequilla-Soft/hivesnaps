import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Client, PrivateKey } from '@hiveio/dhive';
import { avatarService } from '../services/AvatarService';
import { uploadImageSmart } from '../utils/imageUploadService';
import { postSnapWithBeneficiaries } from '../services/snapPostingService';
import { convertImageSmart, convertToJPEG } from '../utils/imageConverter';
import { stripImageTags, getAllImageUrls } from '../utils/extractImageInfo';
import { useVideoUpload } from './useVideoUpload';
import { useReply } from './useReply';
import { SessionService } from '../services/SessionService';
import { useEdit } from './useEdit';
import { useGifPicker } from './useGifPickerV2';
import { uploadAudioTo3Speak } from '../services/audioUploadService';

const HIVE_NODES = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// ===== Types =====

export type ComposeMode = 'compose' | 'reply' | 'edit';

interface ComposeState {
    // Content
    text: string;
    images: string[];
    gifs: string[];
    audioEmbedUrl: string | null;
    audioDuration: number;

    // UI State
    uploading: boolean;
    posting: boolean;
    audioUploading: boolean;
    audioRecorderVisible: boolean;
    spoilerModalVisible: boolean;
    spoilerButtonText: string;
    previewVisible: boolean;

    // Text selection for markdown
    selectionStart: number;
    selectionEnd: number;

    // User
    currentUsername: string | null;
    avatarUrl: string | null;
}

type ComposeAction =
    | { type: 'SET_TEXT'; payload: string }
    | { type: 'SET_IMAGES'; payload: string[] }
    | { type: 'ADD_IMAGES'; payload: string[] }
    | { type: 'REMOVE_IMAGE'; payload: number }
    | { type: 'CLEAR_IMAGES' }
    | { type: 'SET_GIFS'; payload: string[] }
    | { type: 'ADD_GIF'; payload: string }
    | { type: 'REMOVE_GIF'; payload: number }
    | { type: 'SET_AUDIO'; payload: { url: string | null; duration: number } }
    | { type: 'CLEAR_AUDIO' }
    | { type: 'SET_AUDIO_RECORDER_VISIBLE'; payload: boolean }
    | { type: 'SET_UPLOADING'; payload: boolean }
    | { type: 'SET_AUDIO_UPLOADING'; payload: boolean }
    | { type: 'SET_POSTING'; payload: boolean }
    | { type: 'SET_SPOILER_MODAL'; payload: { visible: boolean; text?: string } }
    | { type: 'SET_PREVIEW_VISIBLE'; payload: boolean }
    | { type: 'SET_SELECTION'; payload: { start: number; end: number } }
    | { type: 'SET_USER'; payload: { username: string | null; avatarUrl: string | null } }
    | { type: 'CLEAR_FORM' };

const initialState: ComposeState = {
    text: '',
    images: [],
    gifs: [],
    audioEmbedUrl: null,
    audioDuration: 0,
    uploading: false,
    posting: false,
    audioUploading: false,
    audioRecorderVisible: false,
    spoilerModalVisible: false,
    spoilerButtonText: '',
    previewVisible: false,
    selectionStart: 0,
    selectionEnd: 0,
    currentUsername: null,
    avatarUrl: null,
};

function composeReducer(state: ComposeState, action: ComposeAction): ComposeState {
    switch (action.type) {
        case 'SET_TEXT':
            return { ...state, text: action.payload };
        case 'SET_IMAGES':
            return { ...state, images: action.payload };
        case 'ADD_IMAGES':
            return { ...state, images: [...state.images, ...action.payload] };
        case 'REMOVE_IMAGE':
            return { ...state, images: state.images.filter((_, i) => i !== action.payload) };
        case 'CLEAR_IMAGES':
            return { ...state, images: [] };
        case 'SET_GIFS':
            return { ...state, gifs: action.payload };
        case 'ADD_GIF':
            return { ...state, gifs: [...state.gifs, action.payload] };
        case 'REMOVE_GIF':
            return { ...state, gifs: state.gifs.filter((_, i) => i !== action.payload) };
        case 'SET_AUDIO':
            return { ...state, audioEmbedUrl: action.payload.url, audioDuration: action.payload.duration };
        case 'CLEAR_AUDIO':
            return { ...state, audioEmbedUrl: null, audioDuration: 0 };
        case 'SET_AUDIO_RECORDER_VISIBLE':
            return { ...state, audioRecorderVisible: action.payload };
        case 'SET_UPLOADING':
            return { ...state, uploading: action.payload };
        case 'SET_AUDIO_UPLOADING':
            return { ...state, audioUploading: action.payload };
        case 'SET_POSTING':
            return { ...state, posting: action.payload };
        case 'SET_SPOILER_MODAL':
            return {
                ...state,
                spoilerModalVisible: action.payload.visible,
                spoilerButtonText: action.payload.text ?? state.spoilerButtonText,
            };
        case 'SET_PREVIEW_VISIBLE':
            return { ...state, previewVisible: action.payload };
        case 'SET_SELECTION':
            return {
                ...state,
                selectionStart: action.payload.start,
                selectionEnd: action.payload.end,
            };
        case 'SET_USER':
            return {
                ...state,
                currentUsername: action.payload.username,
                avatarUrl: action.payload.avatarUrl,
            };
        case 'CLEAR_FORM':
            return {
                ...state,
                text: '',
                images: [],
                gifs: [],
                audioEmbedUrl: null,
                audioDuration: 0,
                spoilerButtonText: '',
                audioRecorderVisible: false,
                spoilerModalVisible: false,
                previewVisible: false,
            };
        default:
            return state;
    }
}

// ===== Hook Parameters =====

interface UseComposeParams {
    mode: ComposeMode;
    parentAuthor?: string;
    parentPermlink?: string;
    initialText?: string;
    onSuccess?: () => void;
}

// ===== Main Hook =====

export function useCompose({
    mode,
    parentAuthor,
    parentPermlink,
    initialText,
    onSuccess,
}: UseComposeParams) {
    const [state, dispatch] = useReducer(composeReducer, initialState);

    // Sub-hooks for specialized functionality
    const video = useVideoUpload(state.currentUsername);
    const reply = useReply(state.currentUsername, undefined, undefined);
    const edit = useEdit(state.currentUsername, undefined, undefined);

    // Store reply/edit in refs to avoid stale closures
    const replyRef = useRef(reply);
    const editRef = useRef(edit);
    useEffect(() => {
        replyRef.current = reply;
        editRef.current = edit;
    }, [reply, edit]);

    // GIF picker with callback
    const handleGifSelected = useCallback((gifUrl: string) => {
        if (mode === 'reply') {
            replyRef.current.addReplyGif(gifUrl);
            dispatch({ type: 'ADD_GIF', payload: gifUrl });
        } else if (mode === 'edit') {
            editRef.current.addEditGif(gifUrl);
            dispatch({ type: 'ADD_GIF', payload: gifUrl });
        } else {
            dispatch({ type: 'ADD_GIF', payload: gifUrl });
        }
    }, [mode]);

    const gifPicker = useGifPicker({
        onGifSelected: handleGifSelected,
        limit: 20,
    });

    // ===== Load User Credentials =====

    useEffect(() => {
        const loadCredentials = async () => {
            try {
                const storedUsername = SessionService.getCurrentUsername();

                let avatarUrl: string | null = null;
                if (storedUsername) {
                    const immediate =
                        avatarService.getCachedAvatarUrl(storedUsername) ||
                        `https://images.hive.blog/u/${storedUsername}/avatar/original`;
                    avatarUrl = immediate;

                    avatarService
                        .getAvatarUrl(storedUsername)
                        .then(({ url }) => {
                            if (url) {
                                dispatch({
                                    type: 'SET_USER',
                                    payload: { username: storedUsername, avatarUrl: url },
                                });
                            }
                        })
                        .catch(() => { });
                }

                dispatch({
                    type: 'SET_USER',
                    payload: { username: storedUsername, avatarUrl },
                });
            } catch (e) {
                console.error('Error loading credentials:', e);
            }
        };
        loadCredentials();
    }, []);

    // ===== Initialize reply/edit mode =====

    useEffect(() => {
        if (mode === 'reply' && parentAuthor && parentPermlink) {
            console.log('[useCompose] Initializing reply mode for', parentAuthor, parentPermlink);
            reply.openReplyModal({ author: parentAuthor, permlink: parentPermlink });
            console.log('[useCompose] Reply target set in hook state');
        } else if (mode === 'edit' && parentAuthor && parentPermlink && initialText) {
            console.log('[useCompose] Initializing edit mode for', parentAuthor, parentPermlink);

            const textBody = stripImageTags(initialText);
            const allUrls = getAllImageUrls(initialText);

            // Separate GIFs from images
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

            dispatch({ type: 'SET_TEXT', payload: textBody });
            dispatch({ type: 'SET_IMAGES', payload: imageUrls });
            dispatch({ type: 'SET_GIFS', payload: gifUrls });

            edit.openEditModal(
                { author: parentAuthor, permlink: parentPermlink, type: 'snap' },
                initialText
            );

            console.log('[useCompose] Edit target set in hook state');
        }
    }, [mode, parentAuthor, parentPermlink, initialText]);

    // ===== Image Operations =====

    const addImage = useCallback(async () => {
        try {
            let pickType: 'camera' | 'gallery' | 'cancel';

            if (Platform.OS === 'ios') {
                pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
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
                pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
                    Alert.alert(
                        'Add Images',
                        'Choose an option',
                        [
                            { text: 'Take Photo', onPress: () => resolve('camera') },
                            { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
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
                const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
                let finalStatus = currentPermission.status;

                if (finalStatus !== 'granted') {
                    const requestPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
                    allowsEditing: false,
                    quality: 0.8,
                    allowsMultipleSelection: true,
                    selectionLimit: 10,
                });
            }

            if (!result || result.canceled || !result.assets || result.assets.length === 0) return;

            dispatch({ type: 'SET_UPLOADING', payload: true });
            try {
                // Convert each image smartly - only converts HEIC, preserves GIF/PNG
                // Recompress JPEGs to bound upload size when selecting multiple images
                const uploadPromises = result.assets.map(async (asset, index) => {
                    const converted = await convertImageSmart(asset.uri, undefined, 0.8);

                    // For JPEGs, recompress to quality 0.8 to keep upload size bounded
                    let fileUri = converted.uri;
                    let fileType = converted.type;
                    if (converted.type === 'image/jpeg') {
                        const recompressed = await convertToJPEG(converted.uri, 0.8);
                        fileUri = recompressed.uri;
                    }

                    // Extract file extension from converted name to maintain proper type
                    const extension = converted.name.split('.').pop() || 'jpg';
                    const fileToUpload = {
                        uri: fileUri,
                        // Ensure unique names for parallel uploads by including index and timestamp
                        name: `compose-${Date.now()}-${index}.${extension}`,
                        type: fileType,
                    };
                    const uploadResult = await uploadImageSmart(fileToUpload, state.currentUsername);
                    console.log(`[useCompose] Image ${index + 1} uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
                    return uploadResult.url;
                });

                const imageUrls = await Promise.all(uploadPromises);
                dispatch({ type: 'ADD_IMAGES', payload: imageUrls });
            } catch (err) {
                console.error('Image upload error:', err);
                Alert.alert('Upload Failed', 'Failed to upload one or more images. Please try again.');
            } finally {
                dispatch({ type: 'SET_UPLOADING', payload: false });
            }
        } catch (err) {
            console.error('Image picker error:', err);
            Alert.alert('Error', 'Failed to pick images. Please try again.');
        }
    }, [state.currentUsername]);

    const removeImage = useCallback((index: number) => {
        dispatch({ type: 'REMOVE_IMAGE', payload: index });
    }, []);

    const clearAllImages = useCallback(() => {
        dispatch({ type: 'CLEAR_IMAGES' });
    }, []);

    // ===== GIF Operations =====

    const removeGif = useCallback((index: number) => {
        dispatch({ type: 'REMOVE_GIF', payload: index });
    }, []);

    // ===== Text Operations =====

    const setText = useCallback((text: string) => {
        dispatch({ type: 'SET_TEXT', payload: text });
    }, []);

    const setSelection = useCallback((start: number, end: number) => {
        dispatch({ type: 'SET_SELECTION', payload: { start, end } });
    }, []);

    // ===== Modal Operations =====

    const openSpoilerModal = useCallback(() => {
        dispatch({ type: 'SET_SPOILER_MODAL', payload: { visible: true } });
    }, []);

    const closeSpoilerModal = useCallback(() => {
        dispatch({ type: 'SET_SPOILER_MODAL', payload: { visible: false } });
    }, []);

    const setSpoilerButtonText = useCallback((text: string) => {
        dispatch({ type: 'SET_SPOILER_MODAL', payload: { visible: false, text } });
    }, []);

    const openPreview = useCallback(() => {
        dispatch({ type: 'SET_PREVIEW_VISIBLE', payload: true });
    }, []);

    const closePreview = useCallback(() => {
        dispatch({ type: 'SET_PREVIEW_VISIBLE', payload: false });
    }, []);

    // ===== Audio Operations =====

    const openAudioRecorder = useCallback(() => {
        dispatch({ type: 'SET_AUDIO_RECORDER_VISIBLE', payload: true });
    }, []);

    const closeAudioRecorder = useCallback(() => {
        dispatch({ type: 'SET_AUDIO_RECORDER_VISIBLE', payload: false });
    }, []);

    const handleAudioRecorded = useCallback(async (audioBlob: Blob, durationSeconds: number) => {
        dispatch({ type: 'SET_AUDIO_UPLOADING', payload: true });

        try {
            if (!state.currentUsername) {
                throw new Error('Not logged in');
            }

            const result = await uploadAudioTo3Speak(
                audioBlob,
                durationSeconds,
                state.currentUsername,
                {
                    title: `Audio Snap by ${state.currentUsername}`,
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to upload audio');
            }

            dispatch({
                type: 'SET_AUDIO',
                payload: { url: result.playUrl, duration: durationSeconds },
            });
            dispatch({ type: 'SET_AUDIO_RECORDER_VISIBLE', payload: false });

            Alert.alert(
                'Audio Uploaded',
                'Your audio has been uploaded successfully!',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('Error uploading audio:', error);
            Alert.alert(
                'Upload Error',
                error.message || 'Failed to upload audio. Please try again.'
            );
        } finally {
            dispatch({ type: 'SET_AUDIO_UPLOADING', payload: false });
        }
    }, [state.currentUsername]);

    const removeAudio = useCallback(() => {
        dispatch({ type: 'CLEAR_AUDIO' });
    }, []);

    // ===== Validation =====

    const hasPostableContent = useMemo(() => {
        return Boolean(
            state.text.trim() ||
            state.images.length > 0 ||
            state.gifs.length > 0 ||
            video.videoEmbedUrl ||
            state.audioEmbedUrl
        );
    }, [state.text, state.images.length, state.gifs.length, video.videoEmbedUrl, state.audioEmbedUrl]);

    const hasDraftContent = useMemo(() => {
        return Boolean(
            state.text.trim() ||
            state.images.length > 0 ||
            state.gifs.length > 0 ||
            video.hasVideo ||
            state.audioEmbedUrl ||
            state.audioUploading
        );
    }, [state.text, state.images.length, state.gifs.length, video.hasVideo, state.audioEmbedUrl, state.audioUploading]);

    const isSubmitting = useMemo(() => {
        return state.posting || reply.posting || edit.editing || video.uploading || state.audioUploading;
    }, [state.posting, reply.posting, edit.editing, video.uploading, state.audioUploading]);

    const canSubmit = useMemo(() => {
        return hasPostableContent && !isSubmitting;
    }, [hasPostableContent, isSubmitting]);

    // ===== Submit Operations =====

    const submitReply = useCallback(async () => {
        if (!parentAuthor || !parentPermlink) {
            console.error('[useCompose] Missing parent author or permlink for reply');
            Alert.alert('Error', 'Missing reply information. Please try again.');
            return;
        }

        if (!hasPostableContent) {
            console.error('[useCompose] Reply has no content');
            Alert.alert('Error', 'Please enter some text or add an image/GIF/video/audio.');
            return;
        }

        console.log('[useCompose] Submitting reply to', parentAuthor, parentPermlink);

        try {
            await reply.submitReply({
                target: { author: parentAuthor, permlink: parentPermlink },
                text: state.text,
                images: state.images,
                gifs: state.gifs,
                video: video.videoEmbedUrl,
                audio: state.audioEmbedUrl,
            });

            console.log('[useCompose] Reply submission completed successfully');

            dispatch({ type: 'CLEAR_FORM' });
            video.clear();

            Alert.alert(
                'Reply Posted!',
                'Your reply has been published to the Hive blockchain.',
                [{ text: 'OK', onPress: onSuccess }]
            );
        } catch (error) {
            console.error('[useCompose] Reply submission exception:', error);
            Alert.alert('Reply Failed', error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }, [parentAuthor, parentPermlink, hasPostableContent, state.text, state.images, state.gifs, video, reply, onSuccess]);

    const submitEdit = useCallback(async () => {
        if (!parentAuthor || !parentPermlink) {
            console.error('[useCompose] Missing parent author or permlink for edit');
            Alert.alert('Error', 'Missing edit information. Please try again.');
            return;
        }

        if (!hasPostableContent) {
            console.error('[useCompose] Edit has no content');
            Alert.alert('Error', 'Please enter some text or add an image/GIF/video/audio.');
            return;
        }

        console.log('[useCompose] Submitting edit for', parentAuthor, parentPermlink);

        try {
            await edit.submitEdit({
                target: { author: parentAuthor, permlink: parentPermlink },
                text: state.text,
                images: state.images,
                gifs: state.gifs,
                video: video.videoEmbedUrl,
                audio: state.audioEmbedUrl,
            });

            console.log('[useCompose] Edit submission completed successfully');

            dispatch({ type: 'CLEAR_FORM' });
            video.clear();

            Alert.alert(
                'Edit Saved!',
                'Your changes have been published to the Hive blockchain.',
                [{ text: 'OK', onPress: onSuccess }]
            );
        } catch (error) {
            console.error('[useCompose] Edit submission exception:', error);
            Alert.alert('Edit Failed', error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }, [parentAuthor, parentPermlink, hasPostableContent, state.text, state.images, state.gifs, video, edit, onSuccess]);

    const submitPost = useCallback(async () => {
        if (video.uploading || state.audioUploading) {
            Alert.alert('Upload in Progress', 'Please wait for the upload to finish.');
            return;
        }

        if (!hasPostableContent) {
            Alert.alert('Empty Post', 'Please add text, images, GIFs, video, or audio before posting.');
            return;
        }

        if (video.asset && !video.assetId) {
            Alert.alert('Video Not Ready', 'Finish uploading or remove the video before posting.');
            return;
        }

        if (!state.currentUsername) {
            Alert.alert('Not Logged In', 'Please log in to post to Hive.');
            return;
        }

        dispatch({ type: 'SET_POSTING', payload: true });

        try {
            const postingKeyStr = SessionService.getCurrentPostingKey();
            if (!postingKeyStr) {
                throw new Error('Session expired. Please unlock your account again.');
            }
            const postingKey = PrivateKey.fromString(postingKeyStr);

            // Compose body
            let body = state.text.trim();
            if (state.images.length > 0) {
                state.images.forEach((imageUrl, index) => {
                    body += `\n![image${index + 1}](${imageUrl})`;
                });
            }
            if (state.gifs.length > 0) {
                state.gifs.forEach((gifUrl, index) => {
                    body += `\n![gif${index + 1}](${gifUrl})`;
                });
            }
            if (video.videoEmbedUrl) {
                body += `\n${video.videoEmbedUrl}`;
            }
            if (state.audioEmbedUrl) {
                body += `\n${state.audioEmbedUrl}`;
            }

            // Get latest @peak.snaps post (container)
            const discussions = await client.database.call('get_discussions_by_blog', [
                { tag: 'peak.snaps', limit: 1 },
            ]);
            if (!discussions || discussions.length === 0) {
                throw new Error('No container post found.');
            }
            const container = discussions[0];

            const permlink = `snap-${Date.now()}`;

            const allMedia = [...state.images, ...state.gifs];
            const json_metadata = JSON.stringify({
                app: 'hivesnaps/1.0',
                tags: ['hive-178315', 'snaps'],
                image: allMedia,
                video: video.videoEmbedUrl
                    ? { platform: '3speak', url: video.videoEmbedUrl, uploadUrl: video.uploadUrl }
                    : undefined,
                audio: state.audioEmbedUrl
                    ? {
                        platform: '3speak',
                        url: state.audioEmbedUrl,
                        duration: state.audioDuration
                    }
                    : undefined,
            });

            await postSnapWithBeneficiaries(
                client,
                {
                    parentAuthor: container.author,
                    parentPermlink: container.permlink,
                    author: state.currentUsername,
                    permlink,
                    title: '',
                    body,
                    jsonMetadata: json_metadata,
                    hasVideo: !!video.videoEmbedUrl,
                    hasAudio: !!state.audioEmbedUrl,
                },
                postingKey
            );

            console.log('[useCompose] Post published successfully');

            dispatch({ type: 'CLEAR_FORM' });
            video.clear();

            if (onSuccess) {
                onSuccess();
            }

            Alert.alert(
                'Posted!',
                'Your snap has been published to the Hive blockchain.'
            );
        } catch (error) {
            console.error('[useCompose] Post submission error:', error);
            Alert.alert(
                'Post Failed',
                error instanceof Error ? error.message : 'Unknown error occurred'
            );
        } finally {
            dispatch({ type: 'SET_POSTING', payload: false });
        }
    }, [video, hasPostableContent, state, onSuccess]);

    const submit = useCallback(async () => {
        if (mode === 'reply') {
            await submitReply();
        } else if (mode === 'edit') {
            await submitEdit();
        } else {
            await submitPost();
        }
    }, [mode, submitReply, submitEdit, submitPost]);

    // ===== Return stable object =====

    return useMemo(
        () => ({
            // State
            state,
            mode,

            // Sub-hooks
            video,
            gifPicker,
            reply,
            edit,

            // Computed
            hasPostableContent,
            hasDraftContent,
            isSubmitting,
            canSubmit,

            // Actions
            setText,
            setSelection,
            addImage,
            removeImage,
            clearAllImages,
            removeGif,
            openSpoilerModal,
            closeSpoilerModal,
            setSpoilerButtonText,
            openPreview,
            closePreview,
            openAudioRecorder,
            closeAudioRecorder,
            handleAudioRecorded,
            removeAudio,
            submit,
        }),
        [
            state,
            mode,
            video,
            gifPicker,
            reply,
            edit,
            hasPostableContent,
            hasDraftContent,
            isSubmitting,
            canSubmit,
            setText,
            setSelection,
            addImage,
            removeImage,
            clearAllImages,
            removeGif,
            openSpoilerModal,
            closeSpoilerModal,
            setSpoilerButtonText,
            openPreview,
            closePreview,
            openAudioRecorder,
            closeAudioRecorder,
            handleAudioRecorded,
            removeAudio,
            submit,
        ]
    );
}
