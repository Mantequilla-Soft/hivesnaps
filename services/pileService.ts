// "The Pile" — Snapie Points' item market and item-throwing feature, shared
// with the snapie.io web app via the same backend (same Hive username = same
// inventory/pile there). Reads (getPile, listMarketItems) are public; writes
// (buy/throw/claim) require the Bearer JWT from pointsAuthService.ts, same as
// pointsService.ts's awardPoints, and are additionally gated server-side by
// an allowlist (lib/points/config.ts on snapie.io) — a 403 there surfaces as
// an ordinary thrown Error here, same as any other non-OK response.

import { getPointsAuthToken } from './pointsAuthService';
import { emitPointsSpent } from '../utils/pointsEvents';

const SNAPIE_API_URL = 'https://snapie.io';
const FETCH_TIMEOUT_MS = 10_000;
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000; // backoff after a read failure

export interface ItemDTO {
  id: string;
  creatorUsername: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  purchaseCount: number;
}

export interface ItemsPage {
  items: ItemDTO[];
  hasMore: boolean;
}

export interface InventoryEntry {
  item: ItemDTO;
  unitIds: string[];
}

export interface PileThrower {
  username: string;
  createdAt: string;
  /** Redacted to true identity is never sent for an anonymous throw — see
   *  ItemThrow.anonymous server-side; this flag is the only signal left. */
  anonymous: boolean;
}

export interface PileEntry {
  item: ItemDTO;
  count: number;
  recentThrowers: PileThrower[];
}

export type ItemThrowTargetType = 'post' | 'snap';

export type BuyItemStatus =
  | 'purchased'
  | 'already_purchased'
  | 'insufficient_balance'
  | 'item_not_found'
  | 'self_purchase';

export interface BuyItemResult {
  status: BuyItemStatus;
  unitId: string | null;
  balance: number;
}

export type ThrowItemStatus = 'thrown' | 'not_found' | 'insufficient_balance';

export interface ThrowItemResult {
  status: ThrowItemStatus;
  balance: number;
}

export type ClaimOwnItemStatus = 'claimed' | 'item_not_found' | 'not_owner';

export interface ClaimOwnItemResult {
  status: ClaimOwnItemStatus;
  unitId: string | null;
}

let pileCooldownUntil = 0;
let catalogCooldownUntil = 0;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Client-side idempotency key for a purchase attempt — doesn't need to be
 *  cryptographically random (the server only uses it to dedupe a retried
 *  request, not as a security token), so this avoids depending on
 *  crypto.randomUUID(), which isn't reliably available across RN/Hermes
 *  versions without an extra polyfill dependency. */
function generatePurchaseRefKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Everything thrown at one post/Snap, grouped by item. Public endpoint —
 *  no auth, safe to call for any post regardless of who's logged in. */
export async function getPile(author: string, permlink: string): Promise<PileEntry[]> {
  if (Date.now() < pileCooldownUntil) return [];

  try {
    const res = await fetchWithTimeout(
      `${SNAPIE_API_URL}/api/points/market/pile/${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`
    );
    if (!res.ok) {
      throw new Error(`Pile fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { pile: PileEntry[] };
    return data.pile ?? [];
  } catch (error) {
    console.error('[pileService] Error fetching pile:', error);
    pileCooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return [];
  }
}

/** Public item catalog (approved items only). */
export async function listMarketItems(sort: 'hot' | 'new' = 'hot', offset = 0): Promise<ItemsPage> {
  const empty: ItemsPage = { items: [], hasMore: false };
  if (Date.now() < catalogCooldownUntil) return empty;

  const params = new URLSearchParams({ sort, offset: offset.toString() });

  try {
    const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/market/items?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Market items fetch failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ItemsPage;
  } catch (error) {
    console.error('[pileService] Error fetching market items:', error);
    catalogCooldownUntil = Date.now() + ERROR_RETRY_TTL_MS;
    return empty;
  }
}

/** Caller's owned (unthrown) inventory, grouped by item. Requires a session;
 *  returns an empty list rather than throwing when one isn't available, same
 *  as the rest of this app's "no session = feature quietly does nothing"
 *  convention — the throw picker just shows "you don't own anything yet". */
export async function getMyInventory(): Promise<InventoryEntry[]> {
  try {
    const token = await getPointsAuthToken();
    if (!token) return [];

    const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/market/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { inventory: InventoryEntry[] };
    return data.inventory ?? [];
  } catch (error) {
    console.error('[pileService] Error fetching inventory:', error);
    return [];
  }
}

/** Buys one unit of an approved item. Unlike the read functions above, this
 *  is a direct user-initiated action (a tap on "Buy"), so failures throw
 *  descriptive errors instead of swallowing — the caller is expected to show
 *  the user something went wrong, not silently no-op. */
export async function buyItem(itemId: string, price: number): Promise<BuyItemResult> {
  const token = await getPointsAuthToken();
  if (!token) throw new Error('Could not start a session to complete this purchase. Please try again.');

  const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/market/items/${itemId}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ purchaseRefKey: generatePurchaseRefKey() }),
  });
  if (!res.ok) throw new Error('Could not complete this purchase. Please try again.');

  const data = (await res.json()) as BuyItemResult;
  if (data.status === 'purchased') {
    emitPointsSpent({ spent: price, balance: data.balance });
  }
  return data;
}

/** Free unit for the creator of their own item — no charge, no points-spent
 *  event (the balance never moves). */
export async function claimOwnItem(itemId: string): Promise<ClaimOwnItemResult> {
  const token = await getPointsAuthToken();
  if (!token) throw new Error('Could not start a session to claim this. Please try again.');

  const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/market/items/${itemId}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not claim this. Please try again.');

  return (await res.json()) as ClaimOwnItemResult;
}

/** Throws one owned unit at a post/Snap, consuming it. Anonymous throws cost
 *  an additional burn of the item's price on top — `item` is only needed
 *  here to report that spend via emitPointsSpent (the server already knows
 *  the price; this just lets the UI's live balance display react the same
 *  way a purchase does). */
export async function throwItem(
  unitId: string,
  target: { author: string; permlink: string; type: ItemThrowTargetType },
  item: ItemDTO,
  anonymous = false
): Promise<ThrowItemResult> {
  const token = await getPointsAuthToken();
  if (!token) throw new Error('Could not start a session to throw this. Please try again.');

  const res = await fetchWithTimeout(`${SNAPIE_API_URL}/api/points/market/throw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      unitId,
      targetAuthor: target.author,
      targetPermlink: target.permlink,
      targetType: target.type,
      anonymous,
    }),
  });
  if (!res.ok) throw new Error('Could not throw that. Please try again.');

  const data = (await res.json()) as ThrowItemResult;
  if (data.status === 'thrown' && anonymous) {
    emitPointsSpent({ spent: item.price, balance: data.balance });
  }
  return data;
}
