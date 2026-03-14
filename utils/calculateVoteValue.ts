// utils/calculateVoteValue.ts
// Utility function to estimate Hive vote value for a given user and vote weight.

/**
 * Calculates the estimated vote value for a Hive user.
 * Post-fork: voting power no longer affects the dollar value of a vote,
 * only how fast mana depletes. So rshares depend only on effective vests
 * and the vote weight slider (1-100%).
 *
 * @param account Hive account object (from dhive)
 * @param rewardFund Reward fund object (from dhive)
 * @param voteWeight Vote weight (1-100)
 * @param medianPrice HIVE median price in HBD (from get_current_median_history_price)
 * @returns Estimated value in HBD and USD
 */
export function calculateVoteValue(
  account: any,
  rewardFund: any,
  voteWeight: number,
  medianPrice?: number
): { hbd: string; usd: string } {
  if (!account || !rewardFund || !voteWeight)
    return { hbd: '0.000', usd: '0.00' };

  // Parse vesting shares (VESTS)
  const vestingShares = parseFloat(
    (account.vesting_shares || '0').replace(' VESTS', '')
  );
  const receivedVestingShares = parseFloat(
    (account.received_vesting_shares || '0').replace(' VESTS', '')
  );
  const delegatedVestingShares = parseFloat(
    (account.delegated_vesting_shares || '0').replace(' VESTS', '')
  );
  const effectiveVests =
    vestingShares + receivedVestingShares - delegatedVestingShares;

  // Vote weight in basis points (1-10000)
  const voteWeightBP = Math.round(voteWeight * 100);
  const voteWeightFraction = Math.min(Math.max(voteWeightBP / 10000, 0), 1);

  // Post-fork rshares: full power vote, only scaled by weight slider
  // rshares = effectiveVests * 1e6 * weight / 50
  const rshares = (effectiveVests * 1e6 * voteWeightFraction) / 50;

  // Reward fund
  // recent_claims is a large integer (~5e17); parseFloat may lose low-order
  // digits, but the resulting precision loss is negligible for an estimate.
  const recentClaims = parseFloat(rewardFund.recent_claims);
  const rewardBalance = parseFloat(
    (rewardFund.reward_balance || '0').replace(' HIVE', '')
  );

  // Get median price (default 0 if not provided — will show $0.00)
  const price =
    typeof medianPrice === 'number' && medianPrice > 0 ? medianPrice : 0;

  // Calculate vote value
  let voteValueHIVE = 0;
  if (recentClaims > 0) {
    voteValueHIVE = (rshares / recentClaims) * rewardBalance;
  }
  // Convert to HBD using median price
  const voteValueHBD = voteValueHIVE * price;

  return {
    hbd: voteValueHBD.toFixed(3),
    usd: voteValueHBD.toFixed(2),
  };
}
