import {
    amountError,
    calcDelegatableVests,
    calcPendingHbdInterest,
    formatMax,
    isAmountValid,
    newSavingsRequestId,
    parseHiveTime,
    parseOutgoingDelegations,
    parseSavingsWithdrawals,
    parseWalletAccount,
} from '../wallet';
import { buildClaimRewardOp, parsePendingRewards } from '../pendingRewards';

// 1 VESTS = 0.0005 HIVE, so 2,000,000 VESTS = 1,000 HP.
const props = {
    total_vesting_fund_hive: '500.000 HIVE',
    total_vesting_shares: '1000000.000000 VESTS',
    hbd_interest_rate: 1500,
};

describe('parseHiveTime', () => {
    it('treats chain timestamps as UTC', () => {
        expect(parseHiveTime('2026-10-30T19:31:27')?.toISOString()).toBe('2026-10-30T19:31:27.000Z');
    });

    it('returns null for empty or epoch-zero values', () => {
        expect(parseHiveTime('')).toBeNull();
        expect(parseHiveTime('1970-01-01T00:00:00')).toBeNull();
        expect(parseHiveTime(undefined)).toBeNull();
    });
});

describe('calcPendingHbdInterest', () => {
    const lastUpdate = '2026-10-01T00:00:00';
    const start = Date.parse('2026-10-01T00:00:00Z');

    it('accrues the balance since the last update at the APR', () => {
        // 1000 HBD at 15% for 73 days = 1000 × 0.15 × 73/365 = 30 HBD
        const now = start + 73 * 86400 * 1000;
        const interest = calcPendingHbdInterest(
            { savings_hbd_balance: '1000.000 HBD', savings_hbd_seconds: '0', savings_hbd_seconds_last_update: lastUpdate },
            1500,
            now
        );
        expect(interest).toBeCloseTo(30, 3);
    });

    it('adds HBD-seconds already stored on chain', () => {
        // 1000 HBD for 73 days stored as milli-HBD-seconds, nothing since.
        const stored = String(1000 * 1000 * 73 * 86400);
        const interest = calcPendingHbdInterest(
            { savings_hbd_balance: '0.000 HBD', savings_hbd_seconds: stored, savings_hbd_seconds_last_update: lastUpdate },
            1500,
            start
        );
        expect(interest).toBeCloseTo(30, 3);
    });

    it('is zero with no balance, no rate, or a clock behind the last update', () => {
        expect(calcPendingHbdInterest({ savings_hbd_balance: '0.000 HBD' }, 1500)).toBe(0);
        expect(
            calcPendingHbdInterest({ savings_hbd_balance: '10.000 HBD', savings_hbd_seconds_last_update: lastUpdate }, 0, start + 1e9)
        ).toBe(0);
        expect(
            calcPendingHbdInterest({ savings_hbd_balance: '10.000 HBD', savings_hbd_seconds_last_update: lastUpdate }, 1500, start - 1e9)
        ).toBe(0);
    });
});

describe('parseWalletAccount', () => {
    const account = {
        balance: '12.345 HIVE',
        hbd_balance: '6.000 HBD',
        vesting_shares: '4000000.000000 VESTS', // 2000 HP
        delegated_vesting_shares: '1000000.000000 VESTS', // 500 HP
        received_vesting_shares: '200000.000000 VESTS', // 100 HP
        vesting_withdraw_rate: '0.000000 VESTS',
        to_withdraw: 0,
        withdrawn: 0,
        savings_balance: '1.000 HIVE',
        savings_hbd_balance: '100.000 HBD',
        savings_hbd_seconds: '0',
        savings_hbd_seconds_last_update: '2026-10-01T00:00:00',
        savings_hbd_last_interest_payment: '2026-10-01T00:00:00',
    };

    it('reads liquid, HP and savings balances', () => {
        const w = parseWalletAccount(account, props, Date.parse('2026-10-01T00:00:00Z'));
        expect(w.hiveBalance).toBe(12.345);
        expect(w.hbdBalance).toBe(6);
        expect(w.ownHivePower).toBeCloseTo(1500);
        expect(w.hivePower).toBeCloseTo(1600);
        expect(w.delegatedHivePower).toBeCloseTo(500);
        expect(w.receivedHivePower).toBeCloseTo(100);
        expect(w.delegatableHivePower).toBeCloseTo(1500);
        expect(w.savingsHive).toBe(1);
        expect(w.savingsHbd).toBe(100);
        expect(w.hbdInterestRate).toBe(15);
        expect(w.nextInterestPayout?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    });

    it('excludes HP still scheduled to power down from what can be delegated', () => {
        // 1,000,000 VESTS (500 HP) still to withdraw, in micro-VESTS like the chain reports it.
        const w = parseWalletAccount(
            { ...account, vesting_withdraw_rate: '76923.076923 VESTS', to_withdraw: 1_300_000_000_000, withdrawn: 300_000_000_000 },
            props
        );
        expect(w.delegatableHivePower).toBeCloseTo(1000);
        expect(w.activePowerDownRate).toBeCloseTo(38.46, 1);
    });
});

describe('calcDelegatableVests', () => {
    const now = Date.parse('2026-11-19T00:00:00Z');
    const nowSec = now / 1000;
    const base = {
        vesting_shares: '1000.000000 VESTS',
        delegated_vesting_shares: '0.000000 VESTS',
        received_vesting_shares: '0.000000 VESTS',
        vesting_withdraw_rate: '0.000000 VESTS',
        to_withdraw: 0,
        withdrawn: 0,
        voting_manabar: { current_mana: 1000_000000, last_update_time: nowSec },
        downvote_manabar: { current_mana: 250_000000, last_update_time: nowSec },
    };

    it('allows all owned VESTS with full mana', () => {
        expect(calcDelegatableVests(base, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(1000);
    });

    it('is limited by spent voting mana', () => {
        const acct = { ...base, voting_manabar: { current_mana: 400_000000, last_update_time: nowSec } };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(400);
    });

    it('regenerates voting mana over 5 days', () => {
        // 400 + 1000 × (1 day / 5 days) = 600
        const acct = { ...base, voting_manabar: { current_mana: 400_000000, last_update_time: nowSec - 86400 } };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(600);
    });

    it('is limited by spent downvote mana (scaled by the downvote pool)', () => {
        // 50 of 250 downvote mana left → 50 / 25% = 200 VESTS.
        const acct = { ...base, downvote_manabar: { current_mana: 50_000000, last_update_time: nowSec } };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(200);
    });

    it('cannot pass on received delegations', () => {
        const acct = {
            ...base,
            received_vesting_shares: '500.000000 VESTS',
            voting_manabar: { current_mana: 1500_000000, last_update_time: nowSec },
            downvote_manabar: { current_mana: 375_000000, last_update_time: nowSec },
        };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(1000);
    });

    it('excludes VESTS still scheduled to power down', () => {
        // 1000 VESTS powering down at 100/week, 600 left: this week's 100 is
        // already outside max mana, the other 500 can't be delegated.
        const acct = {
            ...base,
            vesting_withdraw_rate: '100.000000 VESTS',
            to_withdraw: 1000_000000,
            withdrawn: 400_000000,
            voting_manabar: { current_mana: 900_000000, last_update_time: nowSec },
            downvote_manabar: { current_mana: 225_000000, last_update_time: nowSec },
        };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBeCloseTo(400);
    });

    it('never goes below zero', () => {
        const acct = { ...base, voting_manabar: { current_mana: 0, last_update_time: nowSec } };
        expect(calcDelegatableVests(acct, { downvote_pool_percent: 2500 }, now)).toBe(0);
    });
});

describe('parseSavingsWithdrawals', () => {
    it('maps and sorts requests by completion time', () => {
        const list = parseSavingsWithdrawals([
            { request_id: 2, to: 'alice', amount: '5.000 HIVE', memo: '', complete: '2026-11-22T10:00:00' },
            { request_id: 1, to: 'alice', amount: '10.000 HBD', memo: 'x', complete: '2026-11-21T10:00:00' },
        ]);
        expect(list.map((w) => w.requestId)).toEqual([1, 2]);
        expect(list[0]).toMatchObject({ amount: 10, currency: 'HBD', memo: 'x' });
        expect(list[1].currency).toBe('HIVE');
    });

    it('tolerates a non-array response', () => {
        expect(parseSavingsWithdrawals(undefined)).toEqual([]);
        expect(parseSavingsWithdrawals({})).toEqual([]);
    });
});

describe('parseOutgoingDelegations', () => {
    it('converts VESTS to HP, drops empty rows and sorts largest first', () => {
        const list = parseOutgoingDelegations(
            [
                { delegatee: 'small', vesting_shares: '20000.000000 VESTS', min_delegation_time: '2026-01-01T00:00:00' },
                { delegatee: 'big', vesting_shares: '2000000.000000 VESTS', min_delegation_time: '2026-01-01T00:00:00' },
                { delegatee: 'gone', vesting_shares: '0.000000 VESTS' },
            ],
            props
        );
        expect(list.map((d) => d.delegatee)).toEqual(['big', 'small']);
        expect(list[0].hp).toBeCloseTo(1000);
        expect(list[1].hp).toBeCloseTo(10);
    });
});

describe('amount validation', () => {
    it('flags too many decimals, non-numbers and over-balance amounts', () => {
        expect(amountError('', 10)).toBeNull();
        expect(amountError('1.2345', 10)).toBe('Maximum 3 decimal places');
        expect(amountError('abc', 10)).toBe('Enter a number');
        expect(amountError('10.001', 10)).toBe('Amount exceeds available balance');
        expect(amountError('10', 10)).toBeNull();
    });

    it('requires a complete amount the broadcast path accepts', () => {
        // "1." shows no error while typing but can't be submitted yet.
        expect(amountError('1.', 10)).toBeNull();
        expect(isAmountValid('1.', 10)).toBe(false);
        expect(isAmountValid('.5', 10)).toBe(true);
    });

    it('requires a positive amount', () => {
        expect(isAmountValid('0', 10)).toBe(false);
        expect(isAmountValid('', 10)).toBe(false);
        expect(isAmountValid('0.001', 10)).toBe(true);
    });

    it('MAX truncates rather than rounding up past the balance', () => {
        expect(formatMax(1.2349)).toBe('1.234');
        expect(formatMax(5)).toBe('5.000');
        expect(formatMax(-1)).toBe('0.000');
        expect(isAmountValid(formatMax(1.2349), 1.2349)).toBe(true);
    });
});

describe('newSavingsRequestId', () => {
    it('is a uint32', () => {
        const id = newSavingsRequestId(Date.parse('2026-11-19T00:00:00Z'));
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThan(0);
        expect(id).toBeLessThan(2 ** 32);
    });
});

describe('buildClaimRewardOp', () => {
    it('claims the exact pending amounts', () => {
        const rewards = parsePendingRewards({
            reward_hive_balance: '0.000 HIVE',
            reward_hbd_balance: '0.512 HBD',
            reward_vesting_balance: '2050.123456 VESTS',
            reward_vesting_hive: '1.204 HIVE',
        });
        expect(buildClaimRewardOp('alice', rewards)).toEqual([
            'claim_reward_balance',
            { account: 'alice', reward_hive: '0.000 HIVE', reward_hbd: '0.512 HBD', reward_vests: '2050.123456 VESTS' },
        ]);
    });
});
