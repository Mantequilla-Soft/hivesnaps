/**
 * Extract hangout room names from post body content.
 * Matches: https://hangout.3speak.tv/room/<room-name>
 */
export function extractHangoutRoomNames(content: string): string[] {
  const pattern = /https?:\/\/hangout\.3speak\.tv\/room\/([\w-]+)/g;
  const results: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    results.push(match[1]);
  }
  return results;
}
