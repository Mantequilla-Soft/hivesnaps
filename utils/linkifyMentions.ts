/**
 * Convert bare @username mentions to clickable markdown profile links.
 *
 * Skips mentions that are already inside a markdown link [text](url) to
 * prevent double-linkification from corrupting the syntax.
 *
 * Produces:  [@username](profile://username)
 * The visual bold/colour treatment is handled downstream via linkStyles.mention.
 */
export function linkifyMentions(text: string): string {
  return text.replace(
    // Hive usernames: start with a letter, end with alphanumeric, 3–16 chars total.
    // Middle chars may include letters, digits, hyphens, and dots.
    /(^|[^\w/@])@([a-z][a-z0-9\-.]{1,14}[a-z0-9])(?![a-z0-9\-.])/gi,
    (match: string, pre: string, username: string, offset: number, source: string): string => {
      const beforeMatch = source.substring(0, offset);
      const afterMatch = source.substring(offset + match.length);

      // Case 1: the match IS the link text — e.g. "[@username" where pre='['
      // and the rest of the string begins with "](url)".  The '[' was captured
      // as `pre` so it doesn't appear in beforeMatch — check pre directly.
      if (pre === '[' && afterMatch.startsWith('](')) {
        return match;
      }

      // Case 2: @username appears somewhere inside a link text that opened
      // earlier — e.g. "[ foo @username](url)".
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets && afterMatch.includes('](')) {
        return match;
      }

      // Hive usernames are always lowercase on-chain
      const normalized = username.toLowerCase();
      return `${pre}[@${normalized}](profile://${normalized})`;
    }
  );
}
