import * as ImagePicker from 'expo-image-picker';
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import { convertImageSmart } from './imageConverter';
import { uploadImageSmart } from './imageUploadService';

type Source = 'camera' | 'gallery' | 'cancel';

function askSource(title: string): Promise<Source> {
    return new Promise<Source>((resolve) => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                { title, options: ['Cancel', 'Take Photo', 'Choose from Gallery'], cancelButtonIndex: 0 },
                (i) => resolve(i === 1 ? 'camera' : i === 2 ? 'gallery' : 'cancel')
            );
        } else {
            Alert.alert(
                title,
                'Choose an option',
                [
                    { text: 'Take Photo', onPress: () => resolve('camera') },
                    { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
                ],
                { cancelable: true, onDismiss: () => resolve('cancel') }
            );
        }
    });
}

function openAppSettings(): void {
    if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
    } else {
        IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
            data: 'package:com.menobass.hivesnaps',
        }).catch(() => Linking.openURL('app-settings:'));
    }
}

async function ensurePermission(source: 'camera' | 'gallery'): Promise<boolean> {
    const current =
        source === 'camera' ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
        const requested =
            source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = requested.status;
    }
    if (status === 'granted') return true;
    Alert.alert(
        source === 'camera' ? 'Camera Permission Required' : 'Photo Library Permission Required',
        source === 'camera'
            ? 'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.'
            : 'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
        [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openAppSettings },
        ]
    );
    return false;
}

export interface PickedImage {
    uri: string;
    fileName?: string;
    /** Bytes, when the picker reports it. */
    fileSize?: number;
    mimeType?: string;
}

/**
 * Ask camera or gallery, check permissions, and pick one image. `square`
 * crops to 1:1 (avatars); otherwise the image is used uncropped, since iOS
 * can only crop square. Resolves null if the user cancels.
 */
export async function pickImage({ title, square }: { title: string; square: boolean }): Promise<PickedImage | null> {
    const source = await askSource(title);
    if (source === 'cancel') return null;
    if (!(await ensurePermission(source))) return null;

    const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: square,
        ...(square ? { aspect: [1, 1] as [number, number] } : {}),
    };
    const result =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? undefined : result.assets?.[0];
    return asset
        ? {
              uri: asset.uri,
              fileName: asset.fileName ?? undefined,
              fileSize: asset.fileSize ?? undefined,
              mimeType: asset.mimeType ?? undefined,
          }
        : null;
}

/** Convert (HEIC → JPEG only) and upload a picked image; resolves its public URL. */
export async function uploadPickedImage(image: PickedImage, username: string): Promise<string> {
    const converted = await convertImageSmart(image.uri, image.fileName, 0.8);
    const result = await uploadImageSmart({ uri: converted.uri, name: converted.name, type: converted.type }, username);
    if (!result?.url) throw new Error('Upload returned no URL.');
    return result.url;
}
