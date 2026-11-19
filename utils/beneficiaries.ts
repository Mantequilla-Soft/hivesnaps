import { isValidHiveUsername, normalizeUsername } from './hiveUsername';

/** A reward beneficiary; weight is in basis points (100 = 1%, 10000 = 100%). */
export interface Beneficiary {
    account: string;
    weight: number;
}

/** The app's share of a blog post's rewards (fixed, added at posting time). */
export const SNAPIE_BENEFICIARY = 'snapie';
/** Hive limits (comment_options beneficiaries extension). */
export const MAX_BENEFICIARIES = 8;
export const MAX_BENEFICIARY_WEIGHT = 10000;

/** @snapie's share: 10% with attached video/audio, otherwise 3%. */
export function snapieShare(hasMedia: boolean): number {
    return hasMedia ? 1000 : 300;
}

const PERCENT_ERROR = 'Enter a percentage between 0.01 and 100.';

export const formatPercent = (weight: number): string => `${Number((weight / 100).toFixed(2))}%`;

/**
 * Parse a percentage typed by the user ("12.5", "12,5", ".5") into basis points.
 * Returns null unless it's a number above 0 and at most 100 with no more
 * than two decimals (Hive weights are whole basis points).
 */
export function parsePercent(input: string): number | null {
    const text = input.trim().replace(',', '.');
    if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
    const weight = Math.round(parseFloat(text) * 100);
    return weight > 0 && weight <= MAX_BENEFICIARY_WEIGHT ? weight : null;
}

/**
 * Why `account`/`weight` can't be added next to the user's existing
 * beneficiaries and the fixed @snapie share, or null if it can. The account
 * is expected normalized (see normalizeUsername).
 */
export function beneficiaryError(
    existing: readonly Beneficiary[],
    account: string,
    weight: number | null,
    { author, snapieWeight }: { author: string | null; snapieWeight: number }
): string | null {
    if (!account) return 'Enter a Hive account name.';
    if (!isValidHiveUsername(account)) return `@${account} isn't a valid Hive account name.`;
    if (author && account === author.toLowerCase()) return 'You already receive the author rewards.';
    if (account === SNAPIE_BENEFICIARY) return `@${SNAPIE_BENEFICIARY} already gets ${formatPercent(snapieWeight)}.`;
    if (existing.some((b) => b.account === account)) return `@${account} is already a beneficiary.`;
    // One slot is taken by @snapie.
    if (existing.length + 1 >= MAX_BENEFICIARIES) return `Hive allows at most ${MAX_BENEFICIARIES} beneficiaries, including @${SNAPIE_BENEFICIARY}.`;
    if (weight === null) return PERCENT_ERROR;
    const remaining = remainingWeight(existing, snapieWeight);
    if (weight > remaining) return `Only ${formatPercent(remaining)} is left to share.`;
    return null;
}

/** Total basis points shared: @snapie plus the user's entries. */
export function allocatedWeight(existing: readonly Beneficiary[], snapieWeight: number): number {
    return snapieWeight + existing.reduce((sum, b) => sum + b.weight, 0);
}

/** Basis points still available for more beneficiaries. */
export function remainingWeight(existing: readonly Beneficiary[], snapieWeight: number): number {
    return Math.max(0, MAX_BENEFICIARY_WEIGHT - allocatedWeight(existing, snapieWeight));
}

export type BeneficiaryInputResult = { ok: true; beneficiary: Beneficiary } | { ok: false; error: string };

/**
 * Turn what the user typed (account, percentage) into a beneficiary that
 * can be added next to `existing`, or the reason it can't.
 */
export function validateBeneficiary(
    existing: readonly Beneficiary[],
    accountInput: string,
    percentInput: string,
    ctx: { author: string | null; snapieWeight: number }
): BeneficiaryInputResult {
    const account = normalizeUsername(accountInput);
    const weight = parsePercent(percentInput);
    const error = beneficiaryError(existing, account, weight, ctx);
    if (error !== null || weight === null) return { ok: false, error: error ?? PERCENT_ERROR };
    return { ok: true, beneficiary: { account, weight } };
}

/**
 * The beneficiaries to broadcast: the user's entries plus @snapie's share,
 * one entry per account (weights summed), sorted by account name as Hive
 * requires. Throws if the result breaks Hive's limits, so a bad list fails
 * before broadcasting rather than at the node.
 */
export function buildBeneficiaries(userEntries: readonly Beneficiary[], snapieWeight: number): Beneficiary[] {
    const weights = new Map<string, number>();
    const add = (account: string, weight: number): void => {
        const name = normalizeUsername(account);
        if (weight > 0) weights.set(name, (weights.get(name) ?? 0) + weight);
    };
    add(SNAPIE_BENEFICIARY, snapieWeight);
    userEntries.forEach((b) => add(b.account, b.weight));

    const list = [...weights.entries()]
        .map(([account, weight]) => ({ account, weight }))
        .sort((a, b) => (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));

    if (list.length > MAX_BENEFICIARIES) throw new Error(`Hive allows at most ${MAX_BENEFICIARIES} beneficiaries.`);
    const total = list.reduce((sum, b) => sum + b.weight, 0);
    if (total > MAX_BENEFICIARY_WEIGHT) throw new Error('Beneficiaries add up to more than 100%.');
    const bad = list.find((b) => !isValidHiveUsername(b.account) || !Number.isInteger(b.weight));
    if (bad) throw new Error(`Invalid beneficiary @${bad.account}.`);
    return list;
}
