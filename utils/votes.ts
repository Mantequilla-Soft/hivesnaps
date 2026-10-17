/**
 * Shared "did the current user upvote this?" helpers — the single source of
 * truth for a check that used to be copy-pasted across nine call sites
 * (FeedScreen, waves, discovery, conversation, user snaps, short cards...).
 *
 * Two vote shapes exist in this codebase:
 * - condenser/wave APIs return `percent` (Hive hundredths, negative for
 *   downvotes) alongside `rshares`.
 * - `bridge.get_ranked_posts` (the blog feed) returns ONLY `voter` and
 *   `rshares` — no `percent` at all — so a naive `percent > 0` check silently
 *   returns false for every blog post.
 *
 * `voteNet` normalizes both shapes to a net-vote delta: +1 upvote, -1
 * downvote, 0 neither/unknown (e.g. a 0-rshares vote from an account with no
 * vesting, which is indistinguishable from "not voted" in the bridge shape).
 */
import type { ActiveVote } from '../services/ModerationService';

/**
 * Net contribution of a single vote entry (+1 up, −1 down, 0 neutral).
 * Exported so callers can compute vote-count deltas against a previous entry.
 */
export function activeVoteNet(vote: ActiveVote | null | undefined): number {
  if (!vote) return 0;
  // Prefer percent when present — it's authoritative even if rshares lags
  // (our own optimistic entries carry percent with rshares: 0).
  if (typeof vote.percent === 'number') {
    if (vote.percent > 0) return 1;
    if (vote.percent < 0) return -1;
    return 0;
  }
  if (typeof vote.rshares === 'number') {
    if (vote.rshares > 0) return 1;
    if (vote.rshares < 0) return -1;
  }
  return 0;
}

/**
 * Whether `username` appears among `activeVotes` as an upvote.
 * Returns false for a missing username or a non-array vote list.
 */
export function hasUserVoted(
  activeVotes: readonly ActiveVote[] | null | undefined,
  username: string | null | undefined
): boolean {
  if (!username || !Array.isArray(activeVotes)) return false;
  return activeVotes.some((v) => !!v && v.voter === username && activeVoteNet(v) === 1);
}

/**
 * Hive's net_votes (upvotes − downvotes) derived from a vote list — used when
 * the API omits `net_votes` (bridge.get_ranked_posts does).
 */
export function deriveNetVotes(
  activeVotes: readonly ActiveVote[] | null | undefined
): number {
  if (!Array.isArray(activeVotes)) return 0;
  return activeVotes.reduce((sum, v) => sum + activeVoteNet(v), 0);
}