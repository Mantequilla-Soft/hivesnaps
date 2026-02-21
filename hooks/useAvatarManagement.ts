import { useState } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as ImagePicker from 'expo-image-picker';
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import { uploadImageSmart } from '../utils/imageUploadService';
import { avatarService } from '../services/AvatarService';
import { saveAvatarImage } from '../utils/avatarUtils';
import { useAppStore } from '../store/context';
import { convertImageSmart } from '../utils/imageConverter';
import { SessionService } from '../services/SessionService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useAvatarManagement = (currentUsername: string | null) => {
  const [editAvatarModalVisible, setEditAvatarModalVisible] = useState(false);
  const [newAvatarImage, setNewAvatarImage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUpdateLoading, setAvatarUpdateLoading] = useState(false);
  const [avatarUpdateSuccess, setAvatarUpdateSuccess] = useState(false);
  const [activeKeyModalVisible, setActiveKeyModalVisible] = useState(false);
  const [activeKeyInput, setActiveKeyInput] = useState('');
  const { setUserProfile } = useAppStore();

  const handleEditAvatarPress = () => {
    setNewAvatarImage(null);
    setAvatarUpdateSuccess(false);
    setActiveKeyInput(''); // Clear active key input
    setEditAvatarModalVisible(true);
  };

  const handleSelectNewAvatar = async () => {
    try {
      // Show action sheet to choose between camera and gallery
      let pickType: 'camera' | 'gallery' | 'cancel';

      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
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
          }
        );
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
            Alert.alert(
              'Select Avatar Image',
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

      // Enhanced permission handling with better error messages
      let result;
      if (pickType === 'camera') {
        // Check current permission status first
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          // Request permission if not granted
          const requestPermission =
            await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction
                        .APPLICATION_DETAILS_SETTINGS,
                      { data: 'package:com.menobass.hivesnaps' }
                    ).catch(() => {
                      // Fallback for older Android versions
                      Linking.openURL('app-settings:');
                    });
                  }
                },
              },
            ]
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        // Media library permission handling
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
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction
                        .APPLICATION_DETAILS_SETTINGS,
                      { data: 'package:com.menobass.hivesnaps' }
                    ).catch(() => {
                      // Fallback for older Android versions
                      Linking.openURL('app-settings:');
                    });
                  }
                },
              },
            ]
          );
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
        });
      }

      if (!result || result.canceled || !result.assets || !result.assets[0])
        return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      try {
        // Smart conversion - only converts HEIC, preserves original format
        const converted = await convertImageSmart(asset.uri, asset.fileName, 0.8);

        const fileToSave = {
          uri: converted.uri,
          name: converted.name,
          type: converted.type,
        };
        const saveResult = await saveAvatarImage(fileToSave, currentUsername!);
        console.log('Avatar image uploaded:', saveResult);
        console.log(`[useAvatarManagement] Avatar saved via ${saveResult.provider} (cost: $${saveResult.cost})`);
        setNewAvatarImage(saveResult.url);
      } catch (err) {
        console.error('Image upload error:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown upload error';
        Alert.alert(
          'Upload Failed',
          `Avatar upload failed: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      } finally {
        setAvatarUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to pick image: ${errorMessage}`, [
        { text: 'OK' },
      ]);
      setAvatarUploading(false);
    }
  };

  const handleNextStep = async () => {
    // Check if we have a stored active key
    const storedActiveKey = SessionService.getCurrentActiveKey();

    if (storedActiveKey) {
      // We have a stored active key - use it directly
      console.log('[useAvatarManagement] Using stored active key');
      setEditAvatarModalVisible(false);
      // Call update directly with the stored key
      await handleUpdateAvatarWithKey(storedActiveKey);
    } else {
      // No stored key - prompt user to enter it
      console.log('[useAvatarManagement] No stored active key, prompting user');
      setEditAvatarModalVisible(false);
      setActiveKeyModalVisible(true);
    }
  };

  const handleUpdateAvatarWithKey = async (activeKeyString: string) => {
    if (!newAvatarImage || !currentUsername || !activeKeyString.trim()) return;

    setAvatarUpdateLoading(true);
    setAvatarUpdateSuccess(false);

    try {
      // Validate and create active key
      let activeKey;
      try {
        const keyStr = activeKeyString.trim();
        // Basic validation: should start with 5 and be roughly the right length
        if (!keyStr.startsWith('5') || keyStr.length < 50) {
          throw new Error('Invalid key format');
        }
        activeKey = PrivateKey.fromString(keyStr);
      } catch (err) {
        throw new Error(
          'Invalid active key format. Please check your key and try again.'
        );
      }

      // Get current account data to preserve existing metadata
      const accounts = await client.database.getAccounts([currentUsername]);
      if (!accounts || !accounts[0]) throw new Error('Account not found');

      const account = accounts[0];

      // Parse existing metadata and preserve it
      let postingMeta = {};
      let jsonMeta = {};

      // Parse posting_json_metadata
      if (account.posting_json_metadata) {
        try {
          postingMeta = JSON.parse(account.posting_json_metadata);
        } catch (err) {
          console.log('Error parsing existing posting_json_metadata:', err);
        }
      }

      // Parse json_metadata
      if (account.json_metadata) {
        try {
          jsonMeta = JSON.parse(account.json_metadata);
        } catch (err) {
          console.log('Error parsing existing json_metadata:', err);
        }
      }

      // Update profile image in both metadata objects
      const updatedPostingMeta = {
        ...postingMeta,
        profile: {
          ...(postingMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };

      const updatedJsonMeta = {
        ...jsonMeta,
        profile: {
          ...(jsonMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };

      // Broadcast account update2 - required for posting_json_metadata support
      const operation = [
        'account_update2',
        {
          account: currentUsername,
          memo_key: account.memo_key,
          json_metadata: JSON.stringify(updatedJsonMeta),
          posting_json_metadata: JSON.stringify(updatedPostingMeta),
          extensions: [], // Required field for account_update2
        },
      ] as const;

      await client.broadcast.sendOperations([operation], activeKey);

      // Update global user profile with new avatar URL
      // Convert reputation to number if needed
      let repNum: number | undefined = undefined;
      if (typeof account.reputation === 'string') {
        repNum = parseInt(account.reputation, 10);
      } else if (typeof account.reputation === 'number') {
        repNum = account.reputation;
      }
      // Extract profile fields from updatedJsonMeta.profile if available
      const profileObj = (updatedJsonMeta as any)?.profile || {};
      const updatedProfile = {
        name: account.name,
        displayName: profileObj.display_name,
        about: profileObj.about,
        location: profileObj.location,
        website: profileObj.website,
        profile_image: newAvatarImage,
        cover_image: profileObj.cover_image,
        reputation: repNum,
        post_count: account.post_count,
        created: account.created,
        json_metadata: account.json_metadata,
        posting_json_metadata: account.posting_json_metadata,
        // profile_image_last_updated will be set only after successful Hive update
      };
      setUserProfile(currentUsername, {
        ...updatedProfile,
        profile_image_last_updated: Date.now(),
      });

      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(true);

      // Clear sensitive data immediately
      setActiveKeyInput('');

      // Clear avatar cache to force refresh of updated avatar
      avatarService.clearCache();

      // Clear any cached avatar data and refresh profile
      setTimeout(async () => {
        setActiveKeyModalVisible(false);
        setEditAvatarModalVisible(false);
        setNewAvatarImage(null);
        setAvatarUpdateSuccess(false);
      }, 2000);
    } catch (err) {
      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(false);
      // Clear sensitive data on error too
      setActiveKeyInput('');
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error('Failed to update profile image: ' + errorMsg);
    }
  };

  // Wrapper function for modal-based active key input
  const handleUpdateAvatar = async () => {
    if (!activeKeyInput.trim()) return;
    await handleUpdateAvatarWithKey(activeKeyInput);
  };

  const closeModals = () => {
    setEditAvatarModalVisible(false);
    setActiveKeyModalVisible(false);
    setNewAvatarImage(null);
    setAvatarUpdateSuccess(false);
    setActiveKeyInput('');
  };

  return {
    editAvatarModalVisible,
    newAvatarImage,
    avatarUploading,
    avatarUpdateLoading,
    avatarUpdateSuccess,
    activeKeyModalVisible,
    activeKeyInput,
    setActiveKeyInput,
    handleEditAvatarPress,
    handleSelectNewAvatar,
    handleNextStep,
    handleUpdateAvatar,
    closeModals,
  };
};
