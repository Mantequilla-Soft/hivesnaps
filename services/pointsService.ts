// Snapie Points — off-chain rewards for on-chain Hive actions, shared with
// the snapie.io web app (same Hive username = same points account there).
// Read endpoints are public; awarding requires the Bearer JWT from
// pointsAuthService.ts, obtained by signing a challenge with the posting key.

import { getPointsAuthToken } from './pointsAuthService';
import { emitPointsEarned } from '../utils/pointsEvents';

const SNAPIE_API_URL = 'https://snapie.io';
const FETCH_TIMEOUT_MS = 10_000;
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000; // backoff after a failure

export type PointsActionType = 'snap' | 'comment' | 'vote';

export interface PointsSummary {
  username: string;
  balance: number;
  lifetimeEarned: number;
  rank: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  lifetimeEarned: number;
  balance: number;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  hasMore: boolean;
}

let summaryCooldownUntil = 0;
let leaderboardCooldownUntil = 0;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPointsSummary(username: string): Promise<PointsSummary | null> {
  if (Date.now() < summaryCooldownUntil) return null;

  try {
    const res = await fetchWithTimeout(
      `${SNAPIE_API_URL}/api/points/summary?username=${encodeURIComponent(username)}`
    );
    if (!res.ok) {
      throw new Error(`Points summary fetch failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as PointsSummary;
  } catch (error) {
    console.error('[pointsService] Error fetching points summary:', error);
    summaryCooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return null;
  }
}

export async function fetchLeaderboard(limit = 50, offset = 0): Promise<LeaderboardPage> {
  const empty: LeaderboardPage = { entries: [], hasMore: false };
  if (Date.now() < leaderboardCooldownUntil) return empty;

  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });

  try {
    const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/leaderboard?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Leaderboard fetch failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as LeaderboardPage;
  } catch (error) {
    console.error('[pointsService] Error fetching leaderboard:', error);
    leaderboardCooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return empty;
  }
}

/** Fire-and-forget award report. Points must NEVER disrupt the underlying user
 *  action, so this is non-blocking and swallows every error. On a real award
 *  it emits via pointsEvents so the toast + any live balance display can react. */
export function awardPoints(
  actionType: PointsActionType,
  username: string,
  targetAuthor: string,
  targetPermlink: string
): void {
  void (async () => {
    try {
      const token = await getPointsAuthToken();
      if (!token) return; // no session (e.g. no stored posting key) — nothing about this should surface to the user

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let awardRes: Response;
      try {
        awardRes = await fetch(`${SNAPIE_API_URL}/api/points/award`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ actionType, author: targetAuthor, permlink: targetPermlink }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!awardRes.ok) return; // server rejected (ineligible, capped, muted, etc.) — silent by design

      const data = (await awardRes.json()) as { status?: string; awarded?: number; balance?: number };
      if (data?.status === 'awarded' && (data.awarded ?? 0) > 0) {
        emitPointsEarned({ awarded: data.awarded!, balance: data.balance ?? 0 });
      }
    } catch {
      // Swallow — nothing about points should ever surface to the user.
    }
  })();
}
