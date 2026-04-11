import React, { useMemo } from 'react';
import { View, Dimensions, Text, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import SafeRenderHtml from '../../components/SafeRenderHtml';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { renderHiveToHtml } from '../../utils/renderHive';
import {
  extractVideoInfo,
  removeVideoUrls,
} from '../../utils/extractVideoInfo';
import {
  preprocessForMarkdown,
  checkForLeftoverHtmlTags,
} from '../../utils/htmlPreprocessing';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import TwitterEmbed from './TwitterEmbed';
import YouTubeEmbed from './YouTubeEmbed';
import ThreeSpeakEmbed from './ThreeSpeakEmbed';
import { getMarkdownStyles } from '../../styles/markdownStyles';
import { buildMarkdownStyles } from '../../utils/markdownStyles';

interface PostBodyProps {
  body: string;
  isDark: boolean;
  colors: {
    text: string;
    button: string;
    border: string;
  } & Record<string, any>;
}

const PostBody: React.FC<PostBodyProps> = ({ body, colors, isDark }) => {
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;

  // Extract video information from original body
  const videoInfo = useMemo(() => extractVideoInfo(body), [body]);

  // Use Ecency's renderHiveToHtml to process the content
  const processedHtml = useMemo(() => {
    try {
      return renderHiveToHtml(body, { breaks: true, proxifyImages: false });
    } catch (error) {
      console.warn('[PostBody] Error processing HTML:', error);
      return body; // Fallback to original body
    }
  }, [body]);

  // Smart HTML detection - check if original content has HTML tags
  const hasComplexHtml = useMemo(() => {
    return (
      body.includes('<div') ||
      body.includes('<p') ||
      body.includes('<span') ||
      body.includes('<img') ||
      body.includes('<a') ||
      body.includes('<h') ||
      body.includes('<ul') ||
      body.includes('<ol') ||
      body.includes('<li') ||
      body.includes('<br') ||
      body.includes('<hr') ||
      body.includes('<center')
    ); // Add center tag detection
  }, [body]);

  // Use HTML renderer for complex HTML, markdown for simple content
  const isHtml = hasComplexHtml;

  // Content to render - use processed HTML only if we detected HTML AND processing succeeded
  const contentToRender =
    isHtml && processedHtml && processedHtml.trim().length > 0
      ? processedHtml
      : body;

  // If HTML processing failed but we detected HTML, force markdown rendering
  const shouldUseMarkdown =
    !isHtml || !processedHtml || processedHtml.trim().length === 0;

  console.log('[PostBody] Content type detection:', {
    isHtml,
    hasComplexHtml,
    bodyLength: body.length,
    processedHtmlLength: processedHtml ? processedHtml.length : 0,
    bodyPreview: body.substring(0, 200),
    processedHtmlPreview: processedHtml
      ? processedHtml.substring(0, 200)
      : 'EMPTY',
    contentToRenderPreview: contentToRender
      ? contentToRender.substring(0, 200)
      : 'EMPTY',
    hasMarkdownHeaders: /^#{1,6}\s/.test(body),
    hasMarkdownBold: /\*\*.*\*\*/.test(body),
    hasMarkdownItalic: /\*.*\*/.test(body),
    hasUTags: body.includes('<u>'),
    hasHTMLHeaders:
      body.includes('<h1') || body.includes('<h2') || body.includes('<h3'),
    willUseHtmlRenderer: !shouldUseMarkdown,
    willUseMarkdownRenderer: shouldUseMarkdown,
    htmlProcessingFailed:
      isHtml && (!processedHtml || processedHtml.trim().length === 0),
  });

  // Additional debug logging for HTML tags
  console.log('[PostBody] HTML tag detection:', {
    hasDiv: body.includes('<div'),
    hasP: body.includes('<p'),
    hasSpan: body.includes('<span'),
    hasImg: body.includes('<img'),
    hasA: body.includes('<a'),
    hasH: body.includes('<h'),
    hasUl: body.includes('<ul'),
    hasOl: body.includes('<ol'),
    hasLi: body.includes('<li'),
    hasBr: body.includes('<br'),
    hasHr: body.includes('<hr'),
    hasCenter: body.includes('<center'),
    hasEm: body.includes('<em'),
    hasStrong: body.includes('<strong'),
    hasB: body.includes('<b'),
    hasI: body.includes('<i'),
    hasU: body.includes('<u'),
  });

  // Log the full HTML content for debugging
  if (body.length < 2000) {
    console.log('[PostBody] Full body content:', body);
  } else {
    console.log(
      '[PostBody] Body content (first 1000 chars):',
      body.substring(0, 1000)
    );
    console.log(
      '[PostBody] Body content (last 1000 chars):',
      body.substring(body.length - 1000)
    );
  }

  // Log the preprocessed content
  if (shouldUseMarkdown) {
    const preprocessed = preprocessForMarkdown(contentToRender);
    console.log(
      '[PostBody] Preprocessed markdown content:',
      preprocessed.substring(0, 500)
    );

    // Check for leftover HTML tags after preprocessing
    const foundLeftovers = checkForLeftoverHtmlTags(preprocessed);
    if (foundLeftovers.length > 0) {
      console.warn(
        '[PostBody] Leftover HTML tags found after preprocessing:',
        foundLeftovers
      );
    }
  }

  // Safety check - ensure we have content to render
  if (!contentToRender || contentToRender.trim().length === 0) {
    console.warn(
      '[PostBody] No content to render, falling back to original body'
    );
    return (
      <View>
        {/* Render embedded video content first */}
        {videoInfo && (
          <View style={{ marginBottom: 12 }}>
            {videoInfo.type === 'ipfs' ? (
              <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === 'twitter' ? (
              <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === 'youtube' ? (
              <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : videoInfo.type === '3speak' ? (
              <ThreeSpeakEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : null}
          </View>
        )}
        <Markdown
          style={getMarkdownStyles(colors, isDark)}
          rules={{
            image: (node, children, parent, styles) => {
              const { src, alt } = node.attributes || {};
              if (!src) return null;
              return (
                <ExpoImage
                  key={src}
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                    marginVertical: 8,
                  }}
                  contentFit='cover'
                  transition={0}
                  cachePolicy='memory-disk'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
          }}
        >
          {preprocessForMarkdown(body)}
        </Markdown>
      </View>
    );
  }

  return (
    <View>
      {/* Render embedded video content first */}
      {videoInfo && (
        <View style={{ marginBottom: 12 }}>
          {videoInfo.type === 'ipfs' ? (
            <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === 'twitter' ? (
            <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === 'youtube' ? (
            <YouTubeEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : videoInfo.type === '3speak' ? (
            <ThreeSpeakEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
          ) : null}
        </View>
      )}

      {/* Content */}
      {!shouldUseMarkdown ? (
        <SafeRenderHtml
          contentWidth={windowWidth - 32}
          source={{ html: contentToRender }}
          baseStyle={{
            color: colors.text,
            fontSize: 16,
            lineHeight: 24,
          }}
          tagsStyles={{
            a: { color: colors.button },
            p: { marginBottom: 16, lineHeight: 24 },
            br: { height: 16, marginBottom: 8 },
            div: { marginBottom: 8 },
            center: { textAlign: 'center', marginBottom: 16 },
            sub: { fontSize: 12 },
            sup: { fontSize: 12 },
            h1: {
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              marginBottom: 16,
              marginTop: 16,
              paddingTop: 8,
              paddingBottom: 4,
              lineHeight: 32,
            },
            h2: {
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 12,
              marginTop: 12,
              paddingTop: 6,
              paddingBottom: 3,
              lineHeight: 28,
            },
            h3: {
              color: colors.text,
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 10,
              marginTop: 10,
              paddingTop: 4,
              paddingBottom: 2,
              lineHeight: 26,
            },
            u: { textDecorationLine: 'underline' },
            strong: { fontWeight: 'bold' },
            b: { fontWeight: 'bold' },
            em: { fontStyle: 'italic' },
            i: { fontStyle: 'italic' },
          }}
          renderersProps={{
            a: {
              onPress: (_event: unknown, href?: string): void => {
                if (!href) return;
                if (href.startsWith('hashtag://')) {
                  const tag = href.replace('hashtag://', '');
                  router.push({
                    pathname: '/screens/DiscoveryScreen',
                    params: { hashtag: tag },
                  });
                } else if (href.startsWith('profile://')) {
                  const username = href.replace('profile://', '');
                  router.push({
                    pathname: '/screens/ProfileScreen',
                    params: { username },
                  });
                } else {
                  Linking.openURL(href).catch(() => {});
                }
              },
            },
          }}
        />
      ) : (
        <Markdown
          style={getMarkdownStyles(colors, isDark)}
          rules={{
            heading1: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 24,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 24,
                      fontWeight: 'bold',
                      lineHeight: 32,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            heading2: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 20,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: 'bold',
                      lineHeight: 28,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            heading3: (node, children, parent, styles) => {
              return (
                <View
                  key={node.key}
                  style={{
                    marginTop: 16,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: 'bold',
                      lineHeight: 26,
                      includeFontPadding: false,
                    }}
                  >
                    {children}
                  </Text>
                </View>
              );
            },
            image: (node, children, parent, styles) => {
              const { src, alt } = node.attributes || {};
              if (!src) return null;
              return (
                <ExpoImage
                  key={src}
                  source={{ uri: src }}
                  style={{
                    width: '100%',
                    height: 220,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                    marginVertical: 8,
                  }}
                  contentFit='cover'
                  transition={0}
                  cachePolicy='memory-disk'
                  accessibilityLabel={alt || 'image'}
                />
              );
            },
            link: (node, children, parent, styles) => {
              const { href } = node.attributes;

              // Handle profile:// links for mentions
              if (href && href.startsWith('profile://')) {
                const username = href.replace('profile://', '');
                return (
                  <Text
                    key={node.key}
                    onPress={() =>
                      router.push({
                        pathname: '/screens/ProfileScreen',
                        params: { username },
                      })
                    }
                    style={{
                      color: colors.button,
                      fontWeight: 'bold',
                    }}
                    accessibilityRole='link'
                    accessibilityLabel={`View @${username}'s profile`}
                  >
                    @{username}
                  </Text>
                );
              }

              // Handle hashtag:// deep links from Ecency and similar apps
              if (href && href.startsWith('hashtag://')) {
                const tag = href.replace('hashtag://', '');
                return (
                  <Text
                    key={node.key}
                    onPress={() =>
                      router.push({
                        pathname: '/screens/DiscoveryScreen',
                        params: { hashtag: tag },
                      })
                    }
                    style={{ color: colors.button, fontWeight: 'bold' }}
                    accessibilityRole='link'
                    accessibilityLabel={`Browse #${tag}`}
                  >
                    {children}
                  </Text>
                );
              }

              // Handle regular links
              if (!href) {
                return <Text key={node.key} style={{ color: colors.text }}>{children}</Text>;
              }
              return (
                <Text
                  key={node.key}
                  onPress={() => Linking.openURL(href).catch(() => {})}
                  style={{
                    color: colors.button,
                    textDecorationLine: 'underline',
                  }}
                  accessibilityRole='link'
                  accessibilityLabel={`Open link: ${href}`}
                >
                  {children}
                </Text>
              );
            },
          }}
        >
          {preprocessForMarkdown(contentToRender)}
        </Markdown>
      )}
    </View>
  );
};

export default PostBody;
