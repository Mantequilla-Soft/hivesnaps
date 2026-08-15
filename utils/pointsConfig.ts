// Snapie Points gating — mirrors snapie.io's own lib/points/config.ts ship-dark
// pattern. The award endpoint is server-authoritative regardless (eligibility,
// mutes, daily caps are all enforced there); this flag only controls whether
// hivesnaps shows points UI and signs/sends award calls at all.

const POINTS_FEATURE_FLAG = process.env.EXPO_PUBLIC_ENABLE_POINTS === 'true';

export function isPointsEnabled(username?: string | null): boolean {
  return POINTS_FEATURE_FLAG && !!username;
}
