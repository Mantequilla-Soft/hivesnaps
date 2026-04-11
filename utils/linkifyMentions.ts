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
    /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
    (match, pre, username, offset, string) => {
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);

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

      return `${pre}[@${username}](profile://${username})`;
    }
  );
}
