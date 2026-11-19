/**
 * Pending (unclaimed) author/curation rewards for the home-feed banner.
 *
 * Reads the reward_* fields straight off a Hive account. reward_vesting_hive
 * is the HIVE value of the unclaimed VESTS, so no global props are needed to
 * show HP.
 */

import { parseAsset } from './wallet';

export interface PendingRewards {
  hive: number;
  hbd: number;
  hp: number;
  /** Raw unclaimed VESTS — what claim_reward_balance actually takes. */
  vests: number;
  /** Changes whenever the claimable amounts change; used to re-show the banner after a dismiss. */
  signature: string;
}

interface RewardFields {
  reward_hive_balance?: unknown;
  reward_hbd_balance?: unknown;
  reward_vesting_balance?: unknown;
  reward_vesting_hive?: unknown;
}

export function parsePendingRewards(account: RewardFields | null | undefined): PendingRewards {
  if (!account) return { hive: 0, hbd: 0, hp: 0, vests: 0, signature: '' };
  const hive = parseAsset(account.reward_hive_balance);
  const hbd = parseAsset(account.reward_hbd_balance);
  const vests = parseAsset(account.reward_vesting_balance);
  const hp = parseAsset(account.reward_vesting_hive);
  return { hive, hbd, hp, vests, signature: `${hive.toFixed(3)}|${hbd.toFixed(3)}|${vests.toFixed(6)}` };
}

export function hasPendingRewards(r: PendingRewards): boolean {
  return r.hive > 0 || r.hbd > 0 || r.hp > 0;
}

/** e.g. "0.512 HBD · 1.204 HP" — zero amounts are left out. */
export function formatPendingRewards(r: PendingRewards): string {
  const parts: string[] = [];
  if (r.hbd > 0) parts.push(`${r.hbd.toFixed(3)} HBD`);
  if (r.hive > 0) parts.push(`${r.hive.toFixed(3)} HIVE`);
  if (r.hp > 0) parts.push(`${r.hp.toFixed(3)} HP`);
  return parts.join(' · ');
}

/** The claim_reward_balance operation for everything currently pending. */
export function buildClaimRewardOp(
  account: string,
  r: Pick<PendingRewards, 'hive' | 'hbd' | 'vests'>
): ['claim_reward_balance', Record<string, string>] {
  return [
    'claim_reward_balance',
    {
      account,
      reward_hive: `${r.hive.toFixed(3)} HIVE`,
      reward_hbd: `${r.hbd.toFixed(3)} HBD`,
      reward_vests: `${r.vests.toFixed(6)} VESTS`,
    },
  ];
}
