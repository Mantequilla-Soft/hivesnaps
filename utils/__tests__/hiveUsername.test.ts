jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));

import { hiveAccountExists, normalizeUsername } from '../hiveUsername';
import { getClient } from '../../services/HiveClient';

const getAccounts = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (getClient as jest.Mock).mockReturnValue({ database: { getAccounts } });
});

it('normalizes "@@Foo " to "foo"', () => {
    expect(normalizeUsername(' @@Foo ')).toBe('foo');
});

it('looks the account up on chain', async () => {
    getAccounts.mockResolvedValueOnce([{ name: 'alice' }]).mockResolvedValueOnce([]);
    await expect(hiveAccountExists('alice')).resolves.toBe(true);
    await expect(hiveAccountExists('nobody')).resolves.toBe(false);
    expect(getAccounts).toHaveBeenCalledWith(['alice']);
});

it('skips the request for names that cannot be Hive accounts', async () => {
    await expect(hiveAccountExists('waytoolongforhiveaccounts')).resolves.toBe(false);
    await expect(hiveAccountExists('bad_name')).resolves.toBe(false);
    expect(getAccounts).not.toHaveBeenCalled();
});

it('rejects on network errors so callers can tell them apart', async () => {
    getAccounts.mockRejectedValueOnce(new Error('down'));
    await expect(hiveAccountExists('alice')).rejects.toThrow('down');
});
