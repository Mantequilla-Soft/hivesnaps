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

// Deliberately NOT caught here — a write failure must surface to
// recordPendingPurchase's caller (BuyPointsScreen), which needs to know its
// "safe to retry later" promise didn't actually get persisted. Swallowing it
// previously meant recordPendingPurchase could "succeed" without writing
// anything, so a later unverified/thrown result pointed the user at a
// Retry-verification path that could never find the txid.
async function writePendingPurchases(list: PendingPurchase[]): Promise<void> {
  if (list.length > 0) await AsyncStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(list));
  else await AsyncStorage.removeItem(PENDING_PURCHASE_KEY);
}

/** Records a broadcast transfer's txid BEFORE calling verifyPointsPurchase,
 *  so a crash/app-kill between broadcast and verification — with real HBD
 *  already having left the wallet — still leaves a record to resume from on
 *  next launch, mirroring snapie.io's own buy-points page. Keyed by txid
 *  alongside any other still-unresolved purchase, never replacing one.
 *  Throws on an AsyncStorage failure — see writePendingPurchases. */
export async function recordPendingPurchase(username: string, txid: string): Promise<void> {
  const list = await readPendingPurchases();
  await writePendingPurchases([...list.filter(p => p.txid !== txid), { txid, username, createdAt: Date.now() }]);
}

/** Removes a single resolved purchase, leaving any other pending ones intact.
 *  Unlike recordPendingPurchase, a failure here is non-critical — worst case
 *  a resolved txid gets re-verified later and comes back 'duplicate', a
 *  harmless no-op — so it's logged rather than thrown. */
export async function clearPendingPurchase(txid: string): Promise<void> {
  try {
    const list = await readPendingPurchases();
    await writePendingPurchases(list.filter(p => p.txid !== txid));
  } catch (err) {
    console.error('[pointsService] Error clearing a resolved pending purchase (non-critical):', err);
  }
}

/** All pending txids for `username` (ignores other accounts' records on a
 *  shared device), dropping any older than PENDING_PURCHASE_MAX_AGE_MS.
 *  Persisting that prune is best-effort — a failure just means it's retried
 *  on the next read, so it's logged rather than thrown. */
export async function getPendingPurchaseTxids(username: string): Promise<string[]> {
  const list = await readPendingPurchases();
  const fresh = list.filter(p => Date.now() - p.createdAt <= PENDING_PURCHASE_MAX_AGE_MS);
  if (fresh.length !== list.length) {
    try {
      await writePendingPurchases(fresh);
    } catch (err) {
      console.error('[pointsService] Error pruning stale pending purchases (non-critical):', err);
    }
  }
  return fresh.filter(p => p.username === username).map(p => p.txid);
}

// Status values that mean "the server has resolved this one way or another
// and nothing further will ever change it" — the ONLY ones that may clear a
// pending-purchase record. 'unverified' means "still propagating, try
// again" and must never clear it either. Deliberately an allowlist, not
// "anything but unverified": an unrecognized or malformed response (a typo'd
// status, an error body, a future status this client doesn't know about)
// must never be treated as resolved — that HBD already left the wallet, and
// clearing the record on a response this code doesn't understand would
// strand it with no path back except a support request.
const RESOLVED_PURCHASE_STATUSES: readonly PurchaseStatus[] = ['credited', 'duplicate', 'out_of_range'];

/** Posts a broadcast transfer's txid for independent on-chain verification
 *  and crediting — the server never trusts a client-supplied amount, so
 *  this only reports what it decided. Clears that txid's pending-purchase
 *  record on a known-resolved outcome (see RESOLVED_PURCHASE_STATUSES), and
 *  emits pointsPurchased on a real credit so any live balance display (e.g.
 *  PointsSection) updates immediately. Throws — leaving the record in place
 *  — for 'unverified' just as before, and now also for any response whose
 *  status isn't one this code recognizes. */
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

  const raw = (await res.json()) as { status?: unknown; pointsCredited?: unknown; balance?: unknown } | null;
  const status = raw?.status as PurchaseStatus | undefined;
  if (status !== 'unverified' && !(status && RESOLVED_PURCHASE_STATUSES.includes(status))) {
    throw new Error('Purchase verification returned an unexpected response.');
  }
  const result: PurchaseResult = {
    status,
    pointsCredited: typeof raw?.pointsCredited === 'number' ? raw.pointsCredited : 0,
    balance: typeof raw?.balance === 'number' ? raw.balance : 0,
  };

  if (RESOLVED_PURCHASE_STATUSES.includes(result.status)) {
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
