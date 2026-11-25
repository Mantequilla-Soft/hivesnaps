jest.mock('../HiveClient', () => ({ getClient: jest.fn() }));

import { getClient } from '../HiveClient';
import {
    clearUsernameLookupCache,
    getKnownValidity,
    searchUsernamesByPrefix,
    validateUsernames,
} from '../usernameLookup';

const call = jest.fn();
const getAccounts = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    clearUsernameLookupCache();
    (getClient as jest.Mock).mockReturnValue({ call, database: { getAccounts } });
});

describe('searchUsernamesByPrefix', () => {
    it('asks lookup_accounts and keeps only names with the prefix', async () => {
        call.mockResolvedValueOnce(['meno', 'menoa', 'mensa', 'mentor']);
        await expect(searchUsernamesByPrefix('Men', 4)).resolves.toEqual(['meno', 'menoa', 'mensa', 'mentor']);
        expect(call).toHaveBeenCalledWith('condenser_api', 'lookup_accounts', ['men', 4]);

        call.mockResolvedValueOnce(['meno', 'menoa', 'mensa']);
        await expect(searchUsernamesByPrefix('meno', 4)).resolves.toEqual(['meno', 'menoa']);
    });

    it('needs 3 characters and survives errors', async () => {
        await expect(searchUsernamesByPrefix('me')).resolves.toEqual([]);
        call.mockRejectedValueOnce(new Error('down'));
        await expect(searchUsernamesByPrefix('xyz')).resolves.toEqual([]);
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('answers longer prefixes from a complete shorter one without a request', async () => {
        call.mockResolvedValueOnce(['zzza', 'zzzb', 'zzzbc', 'zzzz']);
        await searchUsernamesByPrefix('zzz', 8); // 4 < 8 → complete
        await expect(searchUsernamesByPrefix('zzzb', 8)).resolves.toEqual(['zzzb', 'zzzbc']);
        expect(call).toHaveBeenCalledTimes(1);
    });
});

describe('validateUsernames', () => {
    it('batches unknown names, remembers results, and skips impossible names', async () => {
        getAccounts.mockResolvedValueOnce([{ name: 'alice' }]);
        await expect(validateUsernames(['Alice', 'nobody', 'x_y'])).resolves.toEqual(new Set(['alice']));
        expect(getAccounts).toHaveBeenCalledWith(['alice', 'nobody']);
        expect(getKnownValidity('alice')).toBe(true);
        expect(getKnownValidity('nobody')).toBe(false);
        expect(getKnownValidity('x_y')).toBe(false);

        await validateUsernames(['alice', 'nobody']);
        expect(getAccounts).toHaveBeenCalledTimes(1);
    });

    it('names seen in suggestions count as real without a request', async () => {
        call.mockResolvedValueOnce(['menobass']);
        await searchUsernamesByPrefix('menob', 8);
        await expect(validateUsernames(['menobass'])).resolves.toEqual(new Set(['menobass']));
        expect(getAccounts).not.toHaveBeenCalled();
    });

    it('leaves names unresolved when the lookup fails', async () => {
        getAccounts.mockRejectedValueOnce(new Error('down'));
        await validateUsernames(['carol']);
        expect(getKnownValidity('carol')).toBeNull();
    });
});
