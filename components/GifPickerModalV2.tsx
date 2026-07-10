import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiphyGif, getBestGifUrl, getGifPreviewUrl } from '../utils/giphyApi';

/**
 * Color theme interface for the modal
 */
export interface GifPickerColors {
  readonly background: string;
  readonly text: string;
  readonly inputBg: string;
  readonly inputBorder: string;
  readonly button: string;
}

/**
 * Props interface for the GifPickerModal component
 */
export interface GifPickerModalProps {
  /** Whether the modal is visible */
  readonly visible: boolean;
  
  /** Function to call when modal should close */
  readonly onClose: () => void;
  
  /** Function to call when a GIF is selected */
  readonly onSelectGif: (gifUrl: string) => void;
  
  /** Current search query */
  readonly searchQuery: string;
  
  /** Function to update search query */
  readonly onSearchQueryChange: (query: string) => void;
  
  /** Function to submit search */
  readonly onSearchSubmit: (query: string) => void;
  
  /** Array of GIF results */
  readonly gifResults: GiphyGif[];
  
  /** Whether currently loading */
  readonly loading: boolean;
  
  /** Optional error message */
  readonly error?: string | null;
  
  /** Color theme object */
  readonly colors: GifPickerColors;
  
  /** Optional custom title */
  readonly title?: string;
  
  /** Optional placeholder text for search input */
  readonly searchPlaceholder?: string;
}

/**
 * Professional, reusable GIF Picker Modal Component
 * 
 * Based on the working implementation from ComposeScreen.tsx
 * Features:
 * - TypeScript safe with proper interfaces
 * - Responsive grid layout
 * - Search functionality with placeholder handling
 * - Loading states and error handling
 * - Keyboard friendly (search on enter)
 * - Optimized image loading with preview URLs
 * - Proper modal behavior (backdrop, back button)
 * - Theme support
 */
export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  visible,
  onClose,
  onSelectGif,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  gifResults,
  loading,
  error,
  colors,
  title = 'Choose a GIF',
  searchPlaceholder = 'Search for GIFs...',
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  /**
   * Handles GIF selection with proper URL validation
   */
  const handleSelectGif = (gifUrl: string) => {
    if (!gifUrl || typeof gifUrl !== 'string') {
      console.error('[GifPickerModal] Invalid GIF URL:', gifUrl);
      return;
    }
    onSelectGif(gifUrl);
  };

  /**
   * Handles search submission
   */
  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    onSearchSubmit(query);
  };

  /**
   * Renders individual GIF item
   */
  const renderGifItem = ({ item, index }: { item: GiphyGif; index: number }) => {
    // Use the helper functions from giphyApi for best URL selection
    const gifUrl = getBestGifUrl(item);
    const previewUrl = getGifPreviewUrl(item);

    if (!gifUrl) {
      console.warn('[GifPickerModal] No valid GIF URL found for item:', item.id);
      return null;
    }

    return (
      <Pressable
        onPress={() => handleSelectGif(gifUrl)}
        style={({ pressed }) => [
          {
            flex: 1,
            margin: 5,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: colors.inputBg,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Select GIF: ${item.title || 'Untitled'}`}
      >
        <Image
          source={{ uri: previewUrl || gifUrl }}
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 8,
          }}
          resizeMode="cover"
          onError={(error) => {
            console.warn('[GifPickerModal] Image load error:', error.nativeEvent.error);
          }}
        />
      </Pressable>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    const message = error 
      ? error
      : searchQuery.trim() 
        ? 'No GIFs found. Try a different search.'
        : 'Search for GIFs above or browse trending below';

    const iconName = error ? 'exclamation-circle' : 'search';
    const iconColor = error ? '#ff6b6b' : colors.inputBorder;

    return (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
          paddingHorizontal: 20,
        }}
      >
        <FontAwesome name={iconName} size={48} color={iconColor} />
        <Text
          style={{
            color: colors.text,
            marginTop: 10,
            textAlign: 'center',
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {message}
        </Text>
      </View>
    );
  };

  /**
   * Renders loading state
   */
  const renderLoadingState = () => (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
      }}
    >
      <ActivityIndicator size="large" color={colors.button} />
      <Text style={{ color: colors.text, marginTop: 10, fontSize: 16 }}>
        {searchQuery.trim() ? 'Searching GIFs...' : 'Loading trending GIFs...'}
      </Text>
    </View>
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-start' }}
      backdropOpacity={0.5}
      avoidKeyboard={true}
      useNativeDriver={true}
      hideModalContentWhileAnimating={true}
    >
      <View
        style={{
          backgroundColor: colors.background,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          height: '85%',
          paddingTop: insets.top + 10, // Use safe area top + small padding
          marginTop: insets.top > 0 ? 0 : 10, // Only add margin if no safe area
        }}
      >
        {/* Modal Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: colors.inputBorder,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: colors.text,
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              padding: 4,
            })}
            accessibilityRole="button"
            accessibilityLabel="Close GIF picker"
          >
            <FontAwesome name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 15,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.inputBg,
              borderRadius: 20,
              paddingHorizontal: 15,
              paddingVertical: Platform.OS === 'ios' ? 12 : 10,
            }}
          >
            <FontAwesome
              name="search"
              size={16}
              color={colors.text + '80'}
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={{
                flex: 1,
                fontSize: 16,
                color: colors.text,
                padding: 0, // Remove default padding
              }}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.text + '80'}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  onSearchQueryChange('');
                  onSearchSubmit('');
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  padding: 4,
                  marginLeft: 8,
                })}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <FontAwesome
                  name="times-circle"
                  size={16}
                  color={colors.text + '60'}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* GIF Results */}
        <View style={{ flex: 1, paddingHorizontal: 10, paddingBottom: 20 }}>
          {loading ? (
            renderLoadingState()
          ) : gifResults.length > 0 ? (
            <FlatList
              data={gifResults}
              keyExtractor={(item, index) => `gif-${item.id || index}-${index}`}
              renderItem={renderGifItem}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 20,
              }}
              columnWrapperStyle={{
                justifyContent: 'space-between',
              }}
              removeClippedSubviews={true} // Performance optimization
              maxToRenderPerBatch={10} // Performance optimization
              windowSize={5} // Performance optimization
            />
          ) : (
            renderEmptyState()
          )}
        </View>
      </View>
    </Modal>
  );
};

export default GifPickerModal;
