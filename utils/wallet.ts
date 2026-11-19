/**
 * Pure helpers for the wallet screen: parsing a Hive account into the
 * balances the wallet shows, HBD savings interest, savings withdrawals and
 * outgoing HP delegations.
 */
import { vestsToHp } from './hiveCalculations';

export interface GlobalVestingProps {
    total_vesting_fund_hive: string;
    total_vesting_shares: string;
}

export interface WalletData {
    hiveBalance: number;
    hbdBalance: number;
    hivePower: number;       // effective HP (own + received − delegated)
    ownHivePower: number;    // own HP not delegated out (powerdown-able)
    /** Own HP that can still be delegated (excludes HP already scheduled to power down). */
    delegatableHivePower: number;
    delegatedHivePower: number;
    receivedHivePower: number;
    activePowerDownRate: number; // weekly HP payout, 0 = inactive
    savingsHive: number;
    savingsHbd: number;
    /** HBD savings APR as a percentage, e.g. 15 for 15%. */
    hbdInterestRate: number;
    /** Interest accrued on HBD savings since the last payout (estimated). */
    pendingHbdInterest: number;
    /** When the next interest payout can happen (30 days after the last one). */
    nextInterestPayout: Date | null;
}

export interface SavingsWithdrawal {
    requestId: number;
    to: string;
    amount: number;
    currency: 'HIVE' | 'HBD';
    memo: string;
    complete: Date | null;
}

export interface OutgoingDelegation {
    delegatee: string;
    vests: number;
    hp: number;
    minDelegationTime: Date | null;
}

const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;
const INTEREST_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Numeric part of a Hive asset string ("1.234 HIVE") or number; 0 when unparseable. */
export function parseAsset(value: unknown): number {
    if (value === undefined || value === null) return 0;
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
}

/** Hive timestamps are UTC without a trailing Z ("2026-10-30T19:31:27"). */
export function parseHiveTime(value: unknown): Date | null {
    if (typeof value !== 'string' || !value) return null;
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1980) return null;
    return d;
}

/**
 * Interest accrued on HBD savings since the last payout.
 *
 * The chain tracks `savings_hbd_seconds` as (milli-HBD × seconds) up to
 * `savings_hbd_seconds_last_update`; the balance keeps accruing after that.
 * Interest = HBD-seconds / seconds-per-year × APR.
 *
 * @param rateBasisPoints - `hbd_interest_rate` from dynamic global props (1000 = 10%)
 */
export function calcPendingHbdInterest(
    account: {
        savings_hbd_balance?: unknown;
        savings_hbd_seconds?: unknown;
        savings_hbd_seconds_last_update?: unknown;
    },
    rateBasisPoints: number,
    nowMs: number = Date.now()
): number {
    const balanceMilli = Math.round(parseAsset(account.savings_hbd_balance) * 1000);
    const storedSeconds = parseAsset(account.savings_hbd_seconds);
    const lastUpdate = parseHiveTime(account.savings_hbd_seconds_last_update);
    const elapsed = lastUpdate ? Math.max(0, (nowMs - lastUpdate.getTime()) / 1000) : 0;
    const hbdSecondsMilli = storedSeconds + balanceMilli * elapsed;
    const interestMilli = (hbdSecondsMilli / SECONDS_PER_YEAR) * (rateBasisPoints / 10000);
    // Round down to whole milli-HBD, like the chain does.
    return Math.max(0, Math.floor(interestMilli)) / 1000;
}

export function parseWalletAccount(
    account: Record<string, any>,
    props: GlobalVestingProps & { hbd_interest_rate?: number },
    nowMs: number = Date.now()
): WalletData {
    const toHp = (vests: number): number =>
        vestsToHp(vests, props.total_vesting_fund_hive, props.total_vesting_shares);

    const vestingShares = parseAsset(account.vesting_shares);
    const delegatedVests = parseAsset(account.delegated_vesting_shares);
    const receivedVests = parseAsset(account.received_vesting_shares);
    const withdrawRate = parseAsset(account.vesting_withdraw_rate);
    // Still-to-be-paid-out part of an active power down, in VESTS.
    const remainingWithdraw = Math.max(0, (Number(account.to_withdraw) - Number(account.withdrawn)) / 1e6 || 0);

    const ownVests = vestingShares - delegatedVests;
    const rate = Number(props.hbd_interest_rate) || 0;
    const lastPayment = parseHiveTime(account.savings_hbd_last_interest_payment);

    return {
        hiveBalance: parseAsset(account.balance),
        hbdBalance: parseAsset(account.hbd_balance),
        hivePower: toHp(ownVests + receivedVests),
        ownHivePower: toHp(ownVests),
        delegatableHivePower: Math.max(0, toHp(ownVests - remainingWithdraw)),
        delegatedHivePower: toHp(delegatedVests),
        receivedHivePower: toHp(receivedVests),
        activePowerDownRate: toHp(withdrawRate),
        savingsHive: parseAsset(account.savings_balance),
        savingsHbd: parseAsset(account.savings_hbd_balance),
        hbdInterestRate: rate / 100,
        pendingHbdInterest: calcPendingHbdInterest(account, rate, nowMs),
        nextInterestPayout: lastPayment ? new Date(lastPayment.getTime() + INTEREST_PERIOD_MS) : null,
    };
}

export function parseSavingsWithdrawals(raw: unknown): SavingsWithdrawal[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((w: any): SavingsWithdrawal => {
            const amountStr = String(w?.amount ?? '');
            return {
                requestId: Number(w?.request_id),
                to: String(w?.to ?? ''),
                amount: parseAsset(amountStr),
                currency: amountStr.includes('HBD') ? 'HBD' : 'HIVE',
                memo: String(w?.memo ?? ''),
                complete: parseHiveTime(w?.complete),
            };
        })
        .filter((w) => Number.isFinite(w.requestId))
        .sort((a, b) => (a.complete?.getTime() ?? 0) - (b.complete?.getTime() ?? 0));
}

export function parseOutgoingDelegations(raw: unknown, props: GlobalVestingProps): OutgoingDelegation[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((d: any): OutgoingDelegation => {
            const vests = parseAsset(d?.vesting_shares);
            return {
                delegatee: String(d?.delegatee ?? ''),
                vests,
                hp: vestsToHp(vests, props.total_vesting_fund_hive, props.total_vesting_shares),
                minDelegationTime: parseHiveTime(d?.min_delegation_time),
            };
        })
        .filter((d) => d.delegatee && d.vests > 0)
        .sort((a, b) => b.vests - a.vests);
}

/**
 * A savings withdrawal request id must be unique among the account's
 * pending withdrawals; seconds since epoch fits in uint32 and won't collide
 * for one person tapping withdraw.
 */
export function newSavingsRequestId(nowMs: number = Date.now()): number {
    return Math.floor(nowMs / 1000) >>> 0;
}

/**
 * Validates a typed wallet amount against what's available.
 * Returns an error message to show, or null if the amount is fine (an empty
 * field is "not valid yet" but has no message).
 */
export function amountError(raw: string, available: number, decimals = 3): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') return 'Enter a number';
    const fraction = trimmed.split('.')[1] ?? '';
    if (fraction.length > decimals) return `Maximum ${decimals} decimal places`;
    const n = parseFloat(trimmed);
    if (n > available + 1e-9) return 'Amount exceeds available balance';
    return null;
}

export function isAmountValid(raw: string, available: number, decimals = 3): boolean {
    const n = parseFloat(raw.trim());
    return Number.isFinite(n) && n > 0 && amountError(raw, available, decimals) === null;
}

/** Truncate (not round) to `decimals`, so MAX never exceeds the balance. */
export function formatMax(available: number, decimals = 3): string {
    const factor = 10 ** decimals;
    return (Math.floor(Math.max(0, available) * factor + 1e-6) / factor).toFixed(decimals);
}
