/**
 * Helpers for the voters list (tap a vote count → who voted).
 *
 * Each voter's dollar contribution is their share of the post's net rshares
 * applied to the post's payout. That stays correct after payout (when
 * pending_payout_value drops to 0 and the reward fund no longer applies), and
 * the rows add up to the payout shown on the card.
 */

export interface RawActiveVote {
  voter: string;
  percent?: number | string;
  rshares?: number | string;
  reputation?: number | string;
}

export interface PostPayoutFields {
  pending_payout_value?: string;
  total_payout_value?: string;
  curator_payout_value?: string;
}

export interface VoterRow {
  voter: string;
  /** Vote weight in percent, e.g. 50 for a 50% vote; negative for downvotes. */
  percent: number | null;
  /** Estimated $ contribution; negative for downvotes. */
  value: number;
  /** Display reputation (e.g. 62), or null when the API didn't include it. */
  reputation: number | null;
  isDownvote: boolean;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Total $ payout for a post: pending while open, author + curator once paid. */
export function getPostPayout(post: PostPayoutFields): number {
  const pending = parseAmount(post.pending_payout_value);
  if (pending > 0) return pending;
  return parseAmount(post.total_payout_value) + parseAmount(post.curator_payout_value);
}

/** Convert raw Hive reputation to the familiar 25-based display score. */
export function formatReputation(raw: number | string | undefined): number | null {
  const rep = toNumber(raw);
  if (rep === null) return null;
  if (rep === 0) return 25;
  const neg = rep < 0;
  let score = Math.log10(Math.abs(rep));
  score = Math.max(score - 9, 0);
  score = (neg ? -1 : 1) * score * 9 + 25;
  return Math.floor(score);
}

/** Build the voters list, sorted by dollar contribution (largest first). */
export function buildVoterRows(votes: RawActiveVote[], post: PostPayoutFields): VoterRow[] {
  const payout = getPostPayout(post);
  const parsed = votes.map((v) => ({ vote: v, rshares: toNumber(v.rshares) ?? 0 }));
  const netRshares = parsed.reduce((sum, p) => sum + p.rshares, 0);

  return parsed
    .map(({ vote, rshares }) => {
      const pct = toNumber(vote.percent);
      const value = netRshares > 0 ? (rshares / netRshares) * payout : 0;
      return {
        voter: vote.voter,
        percent: pct === null ? null : pct / 100,
        value,
        reputation: formatReputation(vote.reputation),
        isDownvote: (pct !== null && pct < 0) || rshares < 0,
      };
    })
    .sort((a, b) => b.value - a.value || a.voter.localeCompare(b.voter));
}
