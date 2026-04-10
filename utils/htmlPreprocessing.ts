/**
 * HTML preprocessing utilities for converting HTML content to markdown-compatible format
 * This handles common HTML tags that appear in Hive posts and converts them to
 * markdown equivalents or removes them while preserving content.
 */

/**
 * Preprocesses HTML content for markdown rendering by converting HTML tags to markdown format
 * @param content - The HTML content to preprocess
 * @returns The preprocessed content with HTML tags converted to markdown equivalents
 */
export const preprocessForMarkdown = (content: string): string => {
  return (
    content
      // Handle div tags - remove them but preserve content
      .replace(/<div[^>]*>(.*?)<\/div>/gs, '$1\n\n')
      .replace(/<div[^>]*>/g, '') // Remove opening div tags without closing
      .replace(/<\/div>/g, '\n\n') // Replace closing div tags with newlines
      // Handle section, article, span tags - remove them but preserve content
      .replace(/<section[^>]*>(.*?)<\/section>/gs, '$1\n\n')
      .replace(/<article[^>]*>(.*?)<\/article>/gs, '$1\n\n')
      .replace(/<span[^>]*>(.*?)<\/span>/gs, '$1')
      .replace(/<span[^>]*>/g, '') // Remove opening span tags without closing
      .replace(/<\/span>/g, '') // Remove closing span tags
      // Handle center tags (just remove them for markdown)
      .replace(/<center[^>]*>(.*?)<\/center>/gs, '$1\n\n')
      .replace(/<center[^>]*>/g, '') // Remove opening center tags without closing
      .replace(/<\/center>/g, '\n\n') // Replace closing center tags with newlines
      // Handle sub/sup tags - remove wrapper, keep content
      .replace(/<sub[^>]*>(.*?)<\/sub>/gs, '$1')
      .replace(/<sup[^>]*>(.*?)<\/sup>/gs, '$1')
      // Convert HTML tags to markdown equivalents
      .replace(/<u[^>]*>(.*?)<\/u>/gs, '___$1___') // Convert <u> tags to markdown underlines
      .replace(/<strong[^>]*>(.*?)<\/strong>/gs, '**$1**') // Convert <strong> tags to markdown bold
      .replace(/<b[^>]*>(.*?)<\/b>/gs, '**$1**') // Convert <b> tags to markdown bold
      .replace(/<em[^>]*>(.*?)<\/em>/gs, '*$1*') // Convert <em> tags to markdown italic
      .replace(/<i[^>]*>(.*?)<\/i>/gs, '*$1*') // Convert <i> tags to markdown italic
      // Handle link tags - convert to markdown links
      .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)')
      .replace(/<a[^>]*>(.*?)<\/a>/gs, '$1') // Remove a tags without href
      // Handle line breaks
      .replace(/<br\s*\/?>/g, '\n\n') // Convert <br> tags to double newlines for markdown
      .replace(/<\/p>\s*<p[^>]*>/g, '\n\n') // Convert paragraph breaks to double newlines
      .replace(/<p[^>]*>(.*?)<\/p>/gs, '$1\n\n') // Convert <p> tags to content with double newlines
      .replace(/<p[^>]*>/g, '') // Remove opening p tags without closing
      .replace(/<\/p>/g, '\n\n') // Replace closing p tags with newlines
      // Handle headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gs, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gs, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gs, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gs, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gs, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gs, '###### $1\n\n')
      // Handle images - convert HTML img tags to markdown format
      .replace(
        /<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/g,
        '![$2]($1)'
      )
      .replace(
        /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/g,
        '![$1]($2)'
      )
      .replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/g, '![]($1)')
      // Convert @usernames to clickable links
      .replace(
        /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
        '$1[**@$2**](profile://$2)'
      )
      // Clean up excessive whitespace
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with just 2
      .trim()
  );
};

/**
 * List of HTML tags to check for after preprocessing to detect any leftover tags
 */
export const HTML_TAGS_TO_CHECK = [
  '<div',
  '<center',
  '<a',
  '<em',
  '<strong',
  '<b',
  '<i',
  '<u',
  '<p',
  '<span',
  '<br',
  '<sub',
  '<sup',
  '<h1',
  '<h2',
  '<h3',
  '<h4',
  '<h5',
  '<h6',
];

/**
 * Checks for leftover HTML tags in preprocessed content
 * @param content - The preprocessed content to check
 * @returns Array of leftover HTML tags found
 */
export const checkForLeftoverHtmlTags = (content: string): string[] => {
  return HTML_TAGS_TO_CHECK.filter(tag => content.includes(tag));
};
