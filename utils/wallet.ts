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
    /** HP that can be delegated now: limited by voting/downvote mana and excluding HP that is powering down. */
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

/** The fields of a get_accounts record the wallet reads. Values are untrusted RPC data. */
export interface RawWalletAccount {
    balance?: unknown;
    hbd_balance?: unknown;
    vesting_shares?: unknown;
    delegated_vesting_shares?: unknown;
    received_vesting_shares?: unknown;
    vesting_withdraw_rate?: unknown;
    to_withdraw?: unknown;
    withdrawn?: unknown;
    next_vesting_withdrawal?: unknown;
    voting_manabar?: { current_mana?: unknown; last_update_time?: unknown } | null;
    downvote_manabar?: { current_mana?: unknown; last_update_time?: unknown } | null;
    savings_balance?: unknown;
    savings_hbd_balance?: unknown;
    savings_hbd_seconds?: unknown;
    savings_hbd_seconds_last_update?: unknown;
    savings_hbd_last_interest_payment?: unknown;
}

export interface WalletGlobalProps extends GlobalVestingProps {
    hbd_interest_rate?: number;
    /** Share of max mana available for downvotes, in basis points (2500 = 25%). */
    downvote_pool_percent?: number;
}

interface RawSavingsWithdrawal {
    request_id?: unknown;
    to?: unknown;
    amount?: unknown;
    memo?: unknown;
    complete?: unknown;
}

interface RawDelegation {
    delegatee?: unknown;
    vesting_shares?: unknown;
    min_delegation_time?: unknown;
}

/** Smallest HBD deposit; used to trigger an HBD savings interest payout. */
export const COLLECT_INTEREST_HBD = 0.001;

const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;
// Voting and downvote mana fully regenerate over 5 days.
const MANA_REGEN_SECONDS = 5 * 24 * 60 * 60;
const HIVE_100_PERCENT = 10000;
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

/** Integer chain amounts (micro-VESTS) arrive as numbers or strings. */
function toInt(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function regenerate(
    bar: { current_mana?: unknown; last_update_time?: unknown } | null | undefined,
    maxMana: number,
    nowMs: number
): number {
    if (maxMana <= 0) return 0;
    const current = toInt(bar?.current_mana);
    const last = toInt(bar?.last_update_time);
    const elapsed = last > 0 ? Math.max(0, nowMs / 1000 - last) : MANA_REGEN_SECONDS;
    return Math.min(maxMana, current + (maxMana * elapsed) / MANA_REGEN_SECONDS);
}

/**
 * VESTS the account can delegate right now, mirroring hived's
 * delegate_vesting_shares check (HF20+): delegation spends voting and
 * downvote mana, received delegations can't be passed on, and VESTS still
 * scheduled to power down are excluded. All amounts are in VESTS.
 */
export function calcDelegatableVests(
    account: RawWalletAccount,
    props: Pick<WalletGlobalProps, 'downvote_pool_percent'>,
    nowMs: number = Date.now()
): number {
    const vesting = parseAsset(account.vesting_shares);
    const delegated = parseAsset(account.delegated_vesting_shares);
    const received = parseAsset(account.received_vesting_shares);
    const weeklyRate = parseAsset(account.vesting_withdraw_rate);
    const remainingWithdraw = Math.max(0, (toInt(account.to_withdraw) - toInt(account.withdrawn)) / 1e6);
    const weeklyWithdraw = Math.min(weeklyRate, remainingWithdraw);

    // Effective shares exclude this week's withdrawal; mana is tracked in micro-VESTS.
    const maxMana = Math.max(0, (vesting - delegated + received - weeklyWithdraw) * 1e6);
    const votingMana = regenerate(account.voting_manabar, maxMana, nowMs);

    const pct = Number(props.downvote_pool_percent) || 0;
    let downvoteAvailable = votingMana;
    if (pct > 0) {
        const downvoteMana = regenerate(account.downvote_manabar, (maxMana * pct) / HIVE_100_PERCENT, nowMs);
        downvoteAvailable = (downvoteMana * HIVE_100_PERCENT) / pct;
    }

    // Received VESTS are spent first and can't be delegated onwards.
    const notReceived = maxMana - received * 1e6;
    let available = Math.min(votingMana, downvoteAvailable, notReceived);

    // Nothing that is still powering down can be delegated (current week is
    // already out of max mana, so only subtract the rest).
    if (remainingWithdraw > weeklyWithdraw) {
        available -= (remainingWithdraw - weeklyWithdraw) * 1e6;
    }
    return Math.max(0, Math.floor(available)) / 1e6;
}

export function parseWalletAccount(
    account: RawWalletAccount,
    props: WalletGlobalProps,
    nowMs: number = Date.now()
): WalletData {
    const toHp = (vests: number): number =>
        vestsToHp(vests, props.total_vesting_fund_hive, props.total_vesting_shares);

    const vestingShares = parseAsset(account.vesting_shares);
    const delegatedVests = parseAsset(account.delegated_vesting_shares);
    const receivedVests = parseAsset(account.received_vesting_shares);
    const withdrawRate = parseAsset(account.vesting_withdraw_rate);
    const ownVests = vestingShares - delegatedVests;
    const rate = Number(props.hbd_interest_rate) || 0;
    const lastPayment = parseHiveTime(account.savings_hbd_last_interest_payment);

    return {
        hiveBalance: parseAsset(account.balance),
        hbdBalance: parseAsset(account.hbd_balance),
        hivePower: toHp(ownVests + receivedVests),
        ownHivePower: toHp(ownVests),
        delegatableHivePower: toHp(calcDelegatableVests(account, props, nowMs)),
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

/**
 * Whether a "Collect interest" deposit would pay out interest now: there is
 * HBD in savings with interest accrued, the 30-day interval since the last
 * payout has passed, and there's enough liquid HBD for the token deposit.
 */
export function canCollectHbdInterest(
    w: Pick<WalletData, 'savingsHbd' | 'pendingHbdInterest' | 'nextInterestPayout' | 'hbdBalance'>,
    nowMs: number = Date.now()
): boolean {
    return (
        w.savingsHbd > 0 &&
        w.pendingHbdInterest > 0 &&
        w.nextInterestPayout !== null &&
        w.nextInterestPayout.getTime() <= nowMs &&
        w.hbdBalance >= COLLECT_INTEREST_HBD
    );
}

export function parseSavingsWithdrawals(raw: unknown): SavingsWithdrawal[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((w: RawSavingsWithdrawal | null): SavingsWithdrawal => {
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
        .map((d: RawDelegation | null): OutgoingDelegation => {
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

/** Same syntax the broadcast path accepts (useWalletOperations' parsePositiveAmount). */
export const COMPLETE_AMOUNT = /^\d*\.?\d+$/;

/**
 * True when the amount can be submitted. A trailing "." ("1.") gets no error
 * message while typing but isn't submittable until finished.
 */
export function isAmountValid(raw: string, available: number, decimals = 3): boolean {
    const trimmed = raw.trim();
    const n = parseFloat(trimmed);
    return COMPLETE_AMOUNT.test(trimmed) && Number.isFinite(n) && n > 0 && amountError(raw, available, decimals) === null;
}

/** Truncate (not round) to `decimals`, so MAX never exceeds the balance. */
export function formatMax(available: number, decimals = 3): string {
    const factor = 10 ** decimals;
    return (Math.floor(Math.max(0, available) * factor + 1e-6) / factor).toFixed(decimals);
}
