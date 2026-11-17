import { formatPendingRewards, hasPendingRewards, parsePendingRewards } from '../pendingRewards';

const account = {
  reward_hive_balance: '0.000 HIVE',
  reward_hbd_balance: '0.512 HBD',
  reward_vesting_balance: '2050.123456 VESTS',
  reward_vesting_hive: '1.204 HIVE',
};

describe('parsePendingRewards', () => {
  it('reads reward fields from an account', () => {
    const r = parsePendingRewards(account);
    expect(r.hive).toBe(0);
    expect(r.hbd).toBe(0.512);
    expect(r.hp).toBe(1.204);
    expect(hasPendingRewards(r)).toBe(true);
  });

  it('treats a missing account or fields as nothing pending', () => {
    expect(hasPendingRewards(parsePendingRewards(null))).toBe(false);
    expect(hasPendingRewards(parsePendingRewards({}))).toBe(false);
  });

  it('changes signature when amounts change', () => {
    const a = parsePendingRewards(account);
    const b = parsePendingRewards({ ...account, reward_hbd_balance: '0.600 HBD' });
    expect(a.signature).not.toBe(b.signature);
    expect(parsePendingRewards({ ...account }).signature).toBe(a.signature);
  });
});

describe('formatPendingRewards', () => {
  it('lists only non-zero amounts', () => {
    expect(formatPendingRewards(parsePendingRewards(account))).toBe('0.512 HBD · 1.204 HP');
  });
});
