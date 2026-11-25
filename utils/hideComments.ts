/**
 * Removes hidden comments from a reply tree. A hidden comment's replies are
 * kept, moved up into its place, so people's replies to (say) a game result
 * aren't hidden along with it.
 */
export function hideComments<T extends { replies?: T[] }>(comments: T[], isHidden: (c: T) => boolean): T[] {
  return comments.flatMap(comment => {
    const replies = comment.replies ? hideComments(comment.replies, isHidden) : undefined;
    if (isHidden(comment)) return replies ?? [];
    return [{ ...comment, replies }];
  });
}
