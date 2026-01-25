/**
 * Hive Blockchain Calculation Utilities
 * 
 * Provides helper functions for common Hive blockchain calculations
 * such as VESTS to Hive Power conversions, reputation calculations, etc.
 */

/**
 * Convert VESTS to Hive Power (HP)
 * 
 * @param vests - Amount of VESTS to convert
 * @param totalVestingFundHive - Total vesting fund from global props (can be string or Asset)
 * @param totalVestingShares - Total vesting shares from global props (can be string or Asset)
 * @returns Hive Power amount as number
 */
export function vestsToHp(
    vests: number,
    totalVestingFundHive: string | number | { toString(): string } | undefined,
    totalVestingShares: string | number | { toString(): string } | undefined
): number {
    // Handle both string and Asset types from global props
    const totalVestingFundHiveStr =
        typeof totalVestingFundHive === 'string'
            ? totalVestingFundHive
            : totalVestingFundHive?.toString() || '0 HIVE';

    const totalVestingSharesStr =
        typeof totalVestingShares === 'string'
            ? totalVestingShares
            : totalVestingShares?.toString() || '0 VESTS';

    const totalVestingFundHiveNum = parseFloat(
        totalVestingFundHiveStr.replace(' HIVE', '')
    );
    const totalVestingSharesNum = parseFloat(
        totalVestingSharesStr.replace(' VESTS', '')
    );

    // Prevent division by zero
    if (totalVestingSharesNum === 0) {
        return 0;
    }

    const hivePerVests = totalVestingFundHiveNum / totalVestingSharesNum;
    const hp = vests * hivePerVests;

    return hp;
}

/**
 * Calculate reputation score from raw reputation value
 * Based on Hive's reputation algorithm
 * 
 * @param rawReputation - Raw reputation value from blockchain
 * @returns Formatted reputation score (0-100)
 */
export function calculateReputation(rawReputation: number | string): number {
    const rep = typeof rawReputation === 'string' ? parseInt(rawReputation, 10) : rawReputation;

    if (rep === 0) return 25;

    const neg = rep < 0;
    const reputation = Math.log10(Math.abs(rep));
    const out = reputation * 9 + 25;

    return neg ? Math.max(out * -1, 0) : Math.min(out, 100);
}
