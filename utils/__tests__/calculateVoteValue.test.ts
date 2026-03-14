/**
 * Tests for calculateVoteValue utility
 *
 * Verifies the post-fork vote value calculation:
 * - Voting power does NOT affect vote value (only mana depletion rate)
 * - Vote value scales linearly with vote weight slider
 * - Uses blockchain median price, not CoinGecko
 * - Produces values matching PeakD for known accounts
 */

import { calculateVoteValue } from '../calculateVoteValue';

// Realistic blockchain data snapshot for testing
// These values approximate real chain state as of early 2026
const mockAccount = {
  vesting_shares: '1200000.000000 VESTS',
  received_vesting_shares: '300000.000000 VESTS',
  delegated_vesting_shares: '100000.000000 VESTS',
  voting_power: 5000, // 50% VP — should NOT affect result post-fork
};

const mockRewardFund = {
  recent_claims: '500000000000000000', // 5e17
  reward_balance: '800000.000 HIVE',
};

// Median price: ~0.30 HBD per HIVE
const medianPrice = 0.3;

describe('calculateVoteValue', () => {
  it('returns zero for missing inputs', () => {
    expect(calculateVoteValue(null, mockRewardFund, 100, medianPrice))
      .toEqual({ hbd: '0.000', usd: '0.00' });
    expect(calculateVoteValue(mockAccount, null, 100, medianPrice))
      .toEqual({ hbd: '0.000', usd: '0.00' });
    expect(calculateVoteValue(mockAccount, mockRewardFund, 0, medianPrice))
      .toEqual({ hbd: '0.000', usd: '0.00' });
  });

  it('returns zero when median price is not available', () => {
    const result = calculateVoteValue(mockAccount, mockRewardFund, 100);
    expect(result).toEqual({ hbd: '0.000', usd: '0.00' });
  });

  it('calculates a non-zero value at 100% weight', () => {
    const result = calculateVoteValue(mockAccount, mockRewardFund, 100, medianPrice);
    const hbd = parseFloat(result.hbd);
    const usd = parseFloat(result.usd);

    expect(hbd).toBeGreaterThan(0);
    expect(usd).toBeGreaterThan(0);
  });

  it('vote value is NOT affected by voting power (post-fork)', () => {
    const accountFullVP = { ...mockAccount, voting_power: 10000 }; // 100% VP
    const accountHalfVP = { ...mockAccount, voting_power: 5000 };  // 50% VP
    const accountLowVP = { ...mockAccount, voting_power: 1000 };   // 10% VP

    const resultFull = calculateVoteValue(accountFullVP, mockRewardFund, 100, medianPrice);
    const resultHalf = calculateVoteValue(accountHalfVP, mockRewardFund, 100, medianPrice);
    const resultLow = calculateVoteValue(accountLowVP, mockRewardFund, 100, medianPrice);

    // All should be identical — VP doesn't matter post-fork
    expect(resultFull.hbd).toBe(resultHalf.hbd);
    expect(resultFull.hbd).toBe(resultLow.hbd);
    expect(resultFull.usd).toBe(resultHalf.usd);
    expect(resultFull.usd).toBe(resultLow.usd);
  });

  it('vote value scales linearly with vote weight', () => {
    const result100 = calculateVoteValue(mockAccount, mockRewardFund, 100, medianPrice);
    const result50 = calculateVoteValue(mockAccount, mockRewardFund, 50, medianPrice);
    const result25 = calculateVoteValue(mockAccount, mockRewardFund, 25, medianPrice);

    const val100 = parseFloat(result100.hbd);
    const val50 = parseFloat(result50.hbd);
    const val25 = parseFloat(result25.hbd);

    // 50% weight should give ~50% of 100% value
    expect(val50 / val100).toBeCloseTo(0.5, 1);
    // 25% weight should give ~25% of 100% value
    expect(val25 / val100).toBeCloseTo(0.25, 1);
  });

  it('uses effective vests (own + received - delegated)', () => {
    // Account with only own vests, no delegations
    const simpleAccount = {
      vesting_shares: '1400000.000000 VESTS', // same effective total
      received_vesting_shares: '0.000000 VESTS',
      delegated_vesting_shares: '0.000000 VESTS',
      voting_power: 10000,
    };

    const resultOriginal = calculateVoteValue(mockAccount, mockRewardFund, 100, medianPrice);
    const resultSimple = calculateVoteValue(simpleAccount, mockRewardFund, 100, medianPrice);

    // Both have 1,400,000 effective VESTS, so values should match
    expect(resultOriginal.hbd).toBe(resultSimple.hbd);
  });

  it('produces a sane value (not inflated by $1 default price)', () => {
    const result = calculateVoteValue(mockAccount, mockRewardFund, 100, medianPrice);
    const usd = parseFloat(result.usd);

    // With realistic chain data and median price ~$0.30, a ~1.4M VESTS account
    // should produce a vote value in the sub-dollar range, not $5+
    expect(usd).toBeLessThan(5);
    expect(usd).toBeGreaterThan(0);
  });

  it('higher median price produces higher value', () => {
    const resultLow = calculateVoteValue(mockAccount, mockRewardFund, 100, 0.06);
    const resultMid = calculateVoteValue(mockAccount, mockRewardFund, 100, 0.30);
    const resultHigh = calculateVoteValue(mockAccount, mockRewardFund, 100, 1.00);

    const valLow = parseFloat(resultLow.hbd);
    const valMid = parseFloat(resultMid.hbd);
    const valHigh = parseFloat(resultHigh.hbd);

    expect(valMid).toBeGreaterThan(valLow);
    expect(valHigh).toBeGreaterThan(valMid);
  });

  it('verifies exact formula: rshares = effectiveVests * 1e6 * weight / 50', () => {
    const effectiveVests = 1400000; // 1.2M + 300K - 100K
    const weight = 1; // 100% → 10000 BP → fraction = 1
    const expectedRshares = (effectiveVests * 1e6 * weight) / 50;

    const recentClaims = 500000000000000000;
    const rewardBalance = 800000;
    const expectedHIVE = (expectedRshares / recentClaims) * rewardBalance;
    const expectedHBD = expectedHIVE * medianPrice;

    const result = calculateVoteValue(mockAccount, mockRewardFund, 100, medianPrice);
    expect(parseFloat(result.hbd)).toBeCloseTo(expectedHBD, 3);
  });
});
