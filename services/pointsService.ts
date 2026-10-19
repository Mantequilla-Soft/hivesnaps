// Snapie Points — off-chain rewards for on-chain Hive actions, shared with
// the snapie.io web app (same Hive username = same points account there).
// Read endpoints are public; awarding requires the Bearer JWT from
// pointsAuthService.ts, obtained by signing a challenge with the posting key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPointsAuthToken } from './pointsAuthService';
import { emitPointsEarned, emitPointsPurchased } from '../utils/pointsEvents';

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

// --- Buying points ---------------------------------------------------------
// A purchase is a real HBD transfer the caller broadcasts (see
// hooks/useWalletOperations.ts's transfer()); this only covers reporting the
// resulting txid for server-side verification + crediting. Unlike
// awardPoints, failures here must surface to the user — real money moved.

export type PurchaseStatus = 'credited' | 'duplicate' | 'unverified' | 'out_of_range';

export interface PurchaseResult {
  status: PurchaseStatus;
  pointsCredited: number;
  balance: number;
}

const PENDING_PURCHASE_KEY = 'hivesnaps_pending_points_purchases';
// Matches snapie.io's own localStorage pending-purchase TTL.
const PENDING_PURCHASE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingPurchase {
  txid: string;
  username: string;
  createdAt: number;
}

// A LIST keyed by txid, not a single slot — a single slot silently loses an
// earlier unverified txid (real HBD already sent) the moment a second
// purchase is recorded, e.g. the user retries after an 'unverified' result.
// That transfer becomes untracked and only a support request recovers it.
async function readPendingPurchases(): Promise<PendingPurchase[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PURCHASE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingPurchase[]) : [];
  } catch {
    return [];
  }
}

async function writePendingPurchases(list: PendingPurchase[]): Promise<void> {
  try {
    if (list.length > 0) await AsyncStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(list));
    else await AsyncStorage.removeItem(PENDING_PURCHASE_KEY);
  } catch (err) {
    console.error('[pointsService] Error persisting pending purchases:', err);
  }
}

/** Records a broadcast transfer's txid BEFORE calling verifyPointsPurchase,
 *  so a crash/app-kill between broadcast and verification — with real HBD
 *  already having left the wallet — still leaves a record to resume from on
 *  next launch, mirroring snapie.io's own buy-points page. Keyed by txid
 *  alongside any other still-unresolved purchase, never replacing one. */
export async function recordPendingPurchase(username: string, txid: string): Promise<void> {
  const list = await readPendingPurchases();
  await writePendingPurchases([...list.filter(p => p.txid !== txid), { txid, username, createdAt: Date.now() }]);
}

/** Removes a single resolved purchase, leaving any other pending ones intact. */
export async function clearPendingPurchase(txid: string): Promise<void> {
  const list = await readPendingPurchases();
  await writePendingPurchases(list.filter(p => p.txid !== txid));
}

/** All pending txids for `username` (ignores other accounts' records on a
 *  shared device), dropping — and persisting the drop of — any older than
 *  PENDING_PURCHASE_MAX_AGE_MS. */
export async function getPendingPurchaseTxids(username: string): Promise<string[]> {
  const list = await readPendingPurchases();
  const fresh = list.filter(p => Date.now() - p.createdAt <= PENDING_PURCHASE_MAX_AGE_MS);
  if (fresh.length !== list.length) await writePendingPurchases(fresh);
  return fresh.filter(p => p.username === username).map(p => p.txid);
}

/** Posts a broadcast transfer's txid for independent on-chain verification
 *  and crediting — the server never trusts a client-supplied amount, so
 *  this only reports what it decided. Clears that txid's pending-purchase
 *  record on any resolved outcome except 'unverified' (that one means
 *  "still propagating, try again"), and emits pointsPurchased on a real
 *  credit so any live balance display (e.g. PointsSection) updates
 *  immediately. */
export async function verifyPointsPurchase(username: string, txid: string): Promise<PurchaseResult> {
  const token = await getPointsAuthToken();
  if (!token) throw new Error('Could not verify the purchase — please sign in again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${SNAPIE_API_URL}/api/points/purchase/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ txid }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Purchase verification failed: ${res.status} ${res.statusText}`);
  }

  const result = (await res.json()) as PurchaseResult;
  if (result.status !== 'unverified') {
    await clearPendingPurchase(txid);
  }
  if (result.status === 'credited') {
    emitPointsPurchased({ pointsCredited: result.pointsCredited, balance: result.balance });
  }
  return result;
}

/** Call on BuyPointsScreen mount (and from its "Retry verification" action)
 *  — resumes every purchase for `username` that broadcast successfully on a
 *  previous app session but never finished verifying (app killed, network
 *  dropped, right after real HBD left the wallet). A txid whose attempt
 *  throws (no token, network error) is left pending for the next attempt
 *  and simply omitted from the result, rather than counted as resolved. */
export async function resumePendingPurchases(username: string): Promise<PurchaseResult[]> {
  const txids = await getPendingPurchaseTxids(username);
  const results: PurchaseResult[] = [];
  for (const txid of txids) {
    try {
      results.push(await verifyPointsPurchase(username, txid));
    } catch {
      // Still unresolved — left in AsyncStorage for the next attempt.
    }
  }
  return results;
}
