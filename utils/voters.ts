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
  // Round (not floor) to match the reputation API the profile screen shows.
  return Math.round(score);
}

/** get_content returns at most this many active_votes. */
export const GET_CONTENT_VOTE_CAP = 1000;
const LIST_VOTES_PAGE = 1000;
/** Safety stop: 20 pages = 20k votes, far beyond any real post. */
const MAX_EXTRA_PAGES = 20;

interface ListVotesEntry {
  voter: string;
  author: string;
  permlink: string;
  rshares: number | string;
  vote_percent: number;
}

/** Raw RPC call, e.g. `(api, method, params) => getClient().call(api, method, params)`. */
export type HiveRpcCall = (api: string, method: string, params: unknown) => Promise<any>;

/**
 * Every vote on a post. get_content silently stops at 1,000 votes, and the
 * 1,000 it returns are not the biggest ones, so for busier posts the rest
 * are paged in with database_api.list_votes (which has no reputation, so
 * those voters come back without one).
 */
export async function fetchAllVotes(
  call: HiveRpcCall,
  author: string,
  permlink: string
): Promise<{ post: PostPayoutFields; votes: RawActiveVote[] }> {
  const post = (await call('condenser_api', 'get_content', [author, permlink])) || {};
  const votes: RawActiveVote[] = Array.isArray(post.active_votes) ? [...post.active_votes] : [];
  if (votes.length < GET_CONTENT_VOTE_CAP) return { post, votes };

  // Re-read the full list via list_votes, keeping get_content's entries
  // (they carry reputation) and adding whoever it left out.
  const seen = new Map(votes.map(v => [v.voter, v]));
  let start = '';
  for (let page = 0; page < MAX_EXTRA_PAGES; page++) {
    const res = await call('database_api', 'list_votes', {
      start: [author, permlink, start],
      limit: LIST_VOTES_PAGE,
      order: 'by_comment_voter',
    });
    const batch: ListVotesEntry[] = Array.isArray(res?.votes) ? res.votes : [];
    // by_comment_voter runs on into the next comment once this one is done.
    const mine = batch.filter(v => v.author === author && v.permlink === permlink);
    for (const v of mine) {
      if (!seen.has(v.voter)) {
        const entry = { voter: v.voter, rshares: v.rshares, percent: v.vote_percent };
        seen.set(v.voter, entry);
        votes.push(entry);
      }
    }
    if (mine.length < batch.length || batch.length < LIST_VOTES_PAGE) break;
    // The next page starts at (and repeats) the last voter we got.
    const last = mine[mine.length - 1].voter;
    if (last === start) break;
    start = last;
  }
  return { post, votes };
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
