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
 * Convert Hive Power (HP) to VESTS
 * Inverse of vestsToHp — used for power-down operations.
 *
 * @param hp - Hive Power amount to convert
 * @param totalVestingFundHive - Total vesting fund from global props
 * @param totalVestingShares - Total vesting shares from global props
 * @returns VESTS amount as number
 */
export function hpToVests(
    hp: number,
    totalVestingFundHive: string | number | { toString(): string } | undefined,
    totalVestingShares: string | number | { toString(): string } | undefined
): number {
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

    if (totalVestingFundHiveNum === 0) return 0;

    return hp * (totalVestingSharesNum / totalVestingFundHiveNum);
}
