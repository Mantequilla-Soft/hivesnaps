// Snapie Points gating — mirrors snapie.io's own lib/points/config.ts ship-dark
// pattern. The award endpoint is server-authoritative regardless (eligibility,
// mutes, daily caps are all enforced there); this flag only controls whether
// hivesnaps shows points UI and signs/sends award calls at all.

const POINTS_FEATURE_FLAG = process.env.EXPO_PUBLIC_ENABLE_POINTS === 'true';

export function isPointsEnabled(username?: string | null): boolean {
  return POINTS_FEATURE_FLAG && !!username;
}

// Buying points — mirrors snapie.io's lib/points/purchaseConfig.ts exactly.
// Fixed rate, deliberately NOT priced off a live HBD/USD feed (see that
// file's comment for why). Keep these in sync with the server values;
// the server is still the source of truth and re-verifies every purchase
// on-chain, so a stale client constant only affects the UI preview, not
// what actually gets credited.
export const POINTS_PER_HBD = 100;
export const MIN_PURCHASE_HBD = 1;
export const MAX_PURCHASE_HBD = 1000;
export const PURCHASE_PRESETS_HBD = [1, 5, 10, 25];
export const POINTS_RECEIVING_ACCOUNT = 'snapie';
export const PURCHASE_MEMO = 'Snapie Points purchase';

export function hbdToPoints(hbdAmount: number): number {
  return Math.floor(hbdAmount * POINTS_PER_HBD);
}
