import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useSharedContent } from '../../hooks/useSharedContent';
import { useShare } from '../../context/ShareContext';
import { GifPickerModal } from '../../components/GifPickerModalV2';
import { SnapData } from '../../hooks/useConversationData';
import Preview from '../components/Preview';
import { useCompose } from '../../hooks/useCompose';
import AudioRecorderModal from '../components/AudioRecorderModal';
import AudioPreview from '../components/AudioPreview';
import ProgressBar from '../components/ProgressBar';
import { getTheme } from '../../constants/Colors';

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

  // Extract params
  const mode = params.mode || 'compose';
  const parentAuthor = params.parentAuthor;
  const parentPermlink = params.parentPermlink;
  const initialText = params.initialText;

  // Share extension integration
  const { sharedContent, hasSharedContent, clearSharedContent } = useSharedContent();

  // ALL BUSINESS LOGIC NOW IN useCompose HOOK
  const compose = useCompose({
    mode,
    parentAuthor,
    parentPermlink,
    initialText,
    onSuccess: () => router.back(),
  });

  // UI-only refs
  const textInputRef = useRef<TextInput>(null);

  // Memoized colors based on theme from centralized Colors
  const colors = useMemo(() => {
    const theme = getTheme(isDark ? 'dark' : 'light');
    return {
      background: theme.background,
      text: theme.text,
      inputBg: theme.bubble,
      inputBorder: theme.inputBorder,
      button: theme.button,
      buttonText: theme.buttonText,
      buttonInactive: theme.buttonInactive,
      info: theme.textSecondary,
      warning: theme.warning,
      danger: theme.error,
    };
  }, [isDark]);

  // Handle shared content when component mounts
  useEffect(() => {
    if (hasSharedContent && sharedContent) {
      console.log('📱 ComposeScreen received shared content:', sharedContent);

      switch (sharedContent.type) {
        case 'text':
        case 'url':
          if (typeof sharedContent.data === 'string') {
            compose.setText(compose.state.text ? `${compose.state.text}\n\n${sharedContent.data}` : sharedContent.data);
          }
          break;
        case 'image':
          if (typeof sharedContent.data === 'string') {
            compose.addImage();
          }
          break;
        case 'images':
          if (Array.isArray(sharedContent.data)) {
            compose.addImage();
          }
          break;
      }

      clearSharedContent();
    }
  }, [sharedContent, hasSharedContent, clearSharedContent]);

  // Handle resnap URL parameter
  useEffect(() => {
    if (params.resnapUrl) {
      const resnapUrl = Array.isArray(params.resnapUrl) ? params.resnapUrl[0] : params.resnapUrl;

      if (typeof resnapUrl === 'string') {
        const newText = resnapUrl + '\n\n';
        compose.setText(newText);

        const timeoutId = setTimeout(() => {
          textInputRef.current?.focus();
          const cursorPosition = newText.length;
          textInputRef.current?.setSelection(cursorPosition, cursorPosition);
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [params.resnapUrl]);

  // UI event handlers - just delegate to compose hook
  const handleCancel = () => {
    if (compose.hasDraftContent) {
      Alert.alert(
        'Discard Post?',
        'Are you sure you want to discard this post?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Markdown formatting helpers
  const insertMarkdown = (before: string, after: string, placeholder: string) => {
    const { selectionStart, selectionEnd, text } = compose.state;
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection) {
      const beforeText = text.substring(0, selectionStart);
      const selectedText = text.substring(selectionStart, selectionEnd);
      const afterText = text.substring(selectionEnd);
      const newText = beforeText + before + selectedText + after + afterText;
      compose.setText(newText);

      const newCursorPosition = selectionStart + before.length + selectedText.length + after.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition },
        });
      }, 10);
    } else {
      const beforeText = text.substring(0, selectionStart);
      const afterText = text.substring(selectionStart);
      const newText = beforeText + before + placeholder + after + afterText;
      compose.setText(newText);

      const placeholderStart = selectionStart + before.length;
      const placeholderEnd = placeholderStart + placeholder.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: placeholderStart, end: placeholderEnd },
        });
      }, 10);
    }
  };

  const handleBold = () => insertMarkdown('**', '**', 'bold text');
  const handleItalic = () => insertMarkdown('*', '*', 'italic text');
  const handleUnderline = () => insertMarkdown('<u>', '</u>', 'underlined text');

  const handleSpoilerConfirm = () => {
    const buttonText = compose.state.spoilerButtonText.trim() || 'button text';
    const spoilerSyntax = `>! [${buttonText}] spoiler content`;

    const beforeText = compose.state.text.substring(0, compose.state.selectionStart);
    const afterText = compose.state.text.substring(compose.state.selectionStart);
    const newText = beforeText + spoilerSyntax + afterText;
    compose.setText(newText);

    const contentStart = compose.state.selectionStart + `>! [${buttonText}] `.length;
    const contentEnd = contentStart + 'spoiler content'.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: contentStart, end: contentEnd },
      });
    }, 10);

    compose.closeSpoilerModal();
  };

  const handleSelectionChange = (event: any) => {
    const { start, end } = event.nativeEvent.selection;
    compose.setSelection(start, end);
  };

  // Create preview SnapData from current compose state
  const createPreviewSnapData = (): SnapData => {
    let body = compose.state.text.trim();

    if (compose.state.images.length > 0) {
      compose.state.images.forEach((imageUrl, index) => {
        body += `\n![image${index + 1}](${imageUrl})`;
      });
    }
    if (compose.state.gifs.length > 0) {
      compose.state.gifs.forEach((gifUrl, index) => {
        body += `\n![gif${index + 1}](${gifUrl})`;
      });
    }
    if (compose.video.videoEmbedUrl) {
      body += `\n${compose.video.videoEmbedUrl}`;
    }

    return {
      author: compose.state.currentUsername || 'preview-user',
      avatarUrl: compose.state.avatarUrl || undefined,
      body: body,
      created: new Date().toISOString().slice(0, -1),
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
            onPress={compose.submit}
            disabled={!compose.canSubmit}
            style={[
              styles.headerButton,
              styles.postButton,
              {
                backgroundColor: !compose.canSubmit
                  ? colors.buttonInactive
                  : colors.button,
              },
            ]}
          >
            {compose.isSubmitting ? (
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
            {compose.state.avatarUrl ? (
              <Image
                source={{ uri: compose.state.avatarUrl }}
                style={styles.avatar}
                onError={() => { }}
              />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: colors.inputBg }]}
              >
                <FontAwesome name='user' size={20} color={colors.info} />
              </View>
            )}
            <Text style={[styles.username, { color: colors.text }]}>
              {compose.state.currentUsername || 'Anonymous'}
            </Text>
          </View>

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
            value={compose.state.text}
            onChangeText={compose.setText}
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
                    compose.state.text.length > 260
                      ? colors.danger
                      : compose.state.text.length > 240
                        ? colors.warning
                        : colors.info,
                },
              ]}
            >
              {compose.state.text.length}/280
            </Text>
          </View>

          {/* Images preview */}
          {compose.state.images.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  {compose.state.images.length} image{compose.state.images.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.clearAllButton,
                    { backgroundColor: colors.buttonInactive },
                  ]}
                  onPress={compose.clearAllImages}
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
                {compose.state.images.map((imageUrl: string, index: number) => (
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
                      onPress={() => compose.removeImage(index)}
                    >
                      <FontAwesome name='times' size={16} color='#fff' />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* GIF Previews */}
          {compose.state.gifs.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  GIFs ({compose.state.gifs.length})
                </Text>
                {compose.state.gifs.length > 1 && (
                  <TouchableOpacity onPress={() => {
                    // Clear all gifs by removing them one by one
                    for (let i = compose.state.gifs.length - 1; i >= 0; i--) {
                      compose.removeGif(i);
                    }
                  }}>
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
                {compose.state.gifs.map((gifUrl: string, index: number) => (
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
                      onPress={() => compose.removeGif(index)}
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
          {(compose.video.asset || compose.video.assetId || compose.video.uploading || compose.video.error) && (
            <View style={[styles.imagesContainer, { paddingVertical: 12 }]}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  Video
                </Text>
                {!compose.video.uploading && (
                  <TouchableOpacity onPress={compose.video.remove}>
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
                borderColor: compose.video.error ? '#ff3b30' : colors.inputBorder
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {compose.video.thumbnail ? (
                    <Image
                      source={{ uri: compose.video.thumbnail.uri }}
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
                      {compose.video.asset?.filename || 'Video'}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
                      {compose.video.asset?.sizeBytes && (
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          backgroundColor: colors.inputBorder,
                          borderRadius: 4,
                          marginRight: 6,
                          marginTop: 2
                        }}>
                          <Text style={{ color: colors.text, fontSize: 11 }}>
                            {(compose.video.asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </Text>
                        </View>
                      )}
                      {compose.video.asset?.durationMs && (
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          backgroundColor: colors.inputBorder,
                          borderRadius: 4,
                          marginTop: 2
                        }}>
                          <Text style={{ color: colors.text, fontSize: 11 }}>
                            {Math.floor(compose.video.asset.durationMs / 60000)}:{String(Math.floor((compose.video.asset.durationMs % 60000) / 1000)).padStart(2, '0')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {compose.video.uploading && compose.video.uploadProgress && (
                  <ProgressBar
                    progress={compose.video.uploadProgress.percentage}
                    backgroundColor={colors.inputBorder}
                    fillColor={colors.button}
                    height={4}
                    borderRadius={2}
                    label="Uploading..."
                    showPercentage
                    textColor={colors.text}
                    style={{ marginTop: 12 }}
                  />
                )}

                {compose.video.error && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: '#ff3b30', fontSize: 12, marginBottom: 8 }}>
                      {compose.video.error}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      <TouchableOpacity
                        onPress={compose.video.retry}
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
                        onPress={compose.video.remove}
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

                {compose.video.assetId && !compose.video.uploading && !compose.video.error && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: '#34c759', fontSize: 12, fontWeight: '500' }}>
                      ✓ Video ready to post
                    </Text>
                  </View>
                )}
              </View>

              {(compose.video.asset || compose.video.assetId) && (
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

          {/* Audio Preview */}
          {compose.state.audioEmbedUrl && (
            <AudioPreview
              isUploading={compose.state.audioUploading}
              onRemove={compose.removeAudio}
              durationSeconds={compose.state.audioDuration}
              colors={colors}
            />
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
                onPress={compose.openSpoilerModal}
              >
                <FontAwesome name='eye-slash' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={compose.openPreview}
                disabled={!compose.state.text.trim() && compose.state.images.length === 0 && compose.state.gifs.length === 0}
              >
                <FontAwesome
                  name='eye'
                  size={16}
                  color={(!compose.state.text.trim() && compose.state.images.length === 0 && compose.state.gifs.length === 0) ? colors.info : colors.button}
                />
              </TouchableOpacity>
            </View>

            {/* Image and GIF buttons */}
            <View style={styles.mediaButtons}>
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={compose.addImage}
                  disabled={compose.state.uploading || compose.state.images.length >= 10}
                >
                  {compose.state.uploading ? (
                    <ActivityIndicator size='small' color={colors.button} />
                  ) : (
                    <>
                      <FontAwesome
                        name='image'
                        size={20}
                        color={compose.state.images.length >= 10 ? colors.info : colors.button}
                      />
                      {compose.state.images.length > 0 && (
                        <View
                          style={[
                            styles.imageBadge,
                            { backgroundColor: colors.button },
                          ]}
                        >
                          <Text style={styles.imageBadgeText}>
                            {compose.state.images.length}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
                <Text
                  style={[styles.buttonLabel, { color: compose.state.images.length >= 10 ? colors.info : colors.text }]}
                  accessibilityLabel={`${compose.state.images.length} images selected out of 10 maximum`}
                >
                  {compose.state.images.length}/10
                </Text>
              </View>

              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.inputBg, marginLeft: 12 },
                  ]}
                  onPress={compose.gifPicker.openPicker}
                  disabled={compose.state.gifs.length >= 5}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      color: compose.state.gifs.length >= 5 ? colors.info : colors.button,
                      fontWeight: 'bold',
                    }}
                  >
                    GIF
                  </Text>
                  {compose.state.gifs.length > 0 && (
                    <View
                      style={[
                        styles.imageBadge,
                        { backgroundColor: colors.button },
                      ]}
                    >
                      <Text style={styles.imageBadgeText}>{compose.state.gifs.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text
                  style={[styles.buttonLabel, { color: compose.state.gifs.length >= 5 ? colors.info : colors.text }]}
                  accessibilityLabel={`${compose.state.gifs.length} GIFs selected out of 5 maximum`}
                >
                  {compose.state.gifs.length}/5
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg, marginLeft: 12 },
                ]}
                onPress={compose.video.addVideo}
                disabled={compose.video.hasVideo || compose.video.uploading}
              >
                <FontAwesome
                  name="video-camera"
                  size={20}
                  color={(compose.video.hasVideo || compose.video.uploading) ? colors.info : colors.button}
                />
                {compose.video.hasVideo && (
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

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg, marginLeft: 12 },
                ]}
                onPress={compose.openAudioRecorder}
                disabled={compose.state.audioEmbedUrl !== null || compose.state.audioUploading}
              >
                <FontAwesome
                  name="microphone"
                  size={20}
                  color={compose.state.audioEmbedUrl !== null || compose.state.audioUploading ? colors.info : colors.button}
                />
                {compose.state.audioEmbedUrl && (
                  <View
                    style={[
                      styles.imageBadge,
                      { backgroundColor: colors.button },
                    ]}
                  >
                    <Text style={styles.imageBadgeText}>♪</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {compose.state.images.length === 0 && !compose.state.uploading && (
              <Text
                style={[styles.hintText, { color: colors.info }]}
                accessibilityLabel="Tip: Select up to 10 images at once from gallery"
              >
                💡 Select up to 10 images at once from gallery
              </Text>
            )}
            {compose.state.images.length >= 10 && (
              <Text
                style={[styles.limitText, { color: colors.warning }]}
                accessibilityLabel="Warning: Maximum 10 images reached"
              >
                ⚠️ Maximum 10 images reached
              </Text>
            )}
            {compose.state.gifs.length >= 5 && (
              <Text
                style={[styles.limitText, { color: colors.warning }]}
                accessibilityLabel="Warning: Maximum 5 GIFs reached"
              >
                ⚠️ Maximum 5 GIFs reached
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
        visible={compose.gifPicker.state.modalVisible}
        onClose={compose.gifPicker.closePicker}
        onSelectGif={compose.gifPicker.selectGif}
        searchQuery={compose.gifPicker.state.searchQuery}
        onSearchQueryChange={compose.gifPicker.setSearchQuery}
        onSearchSubmit={compose.gifPicker.searchGifs}
        gifResults={compose.gifPicker.state.results}
        loading={compose.gifPicker.state.loading}
        error={compose.gifPicker.state.error}
        colors={{
          background: colors.background,
          text: colors.text,
          inputBg: colors.inputBg,
          inputBorder: colors.inputBorder,
          button: colors.button,
        }}
      />

      {/* Audio Recorder Modal */}
      <AudioRecorderModal
        isVisible={compose.state.audioRecorderVisible}
        onClose={compose.closeAudioRecorder}
        onAudioRecorded={compose.handleAudioRecorded}
      />

      {/* Spoiler Modal */}
      <Modal
        visible={compose.state.spoilerModalVisible}
        transparent
        animationType='fade'
        onRequestClose={compose.closeSpoilerModal}
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
              value={compose.state.spoilerButtonText}
              onChangeText={compose.setSpoilerButtonText}
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
                onPress={compose.closeSpoilerModal}
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
        visible={compose.state.previewVisible}
        onClose={compose.closePreview}
        snapData={createPreviewSnapData()}
        currentUsername={compose.state.currentUsername}
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
  buttonLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  limitText: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 8,
  },
  hintText: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 8,
    fontStyle: 'italic',
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
