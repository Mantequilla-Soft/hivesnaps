jest.mock('../HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../AccountStorageService', () => ({ accountStorageService: { getCurrentPostingKey: jest.fn() } }));
jest.mock('@hiveio/dhive', () => ({ PrivateKey: { fromString: jest.fn(() => 'KEY') } }));

import { consumeProfileSaved, fetchProfileFields, markProfileSaved, saveProfileFields } from '../ProfileService';
import { getClient } from '../HiveClient';
import { accountStorageService } from '../AccountStorageService';
import { EMPTY_PROFILE } from '../../utils/profileMetadata';

const getAccounts = jest.fn();
const sendOperations = jest.fn();
const account = {
    name: 'meno',
    posting_json_metadata: JSON.stringify({ profile: { name: 'Old', pinned: 'p' }, peakd: { x: 1 } }),
    json_metadata: '{}',
};

beforeEach(() => {
    jest.clearAllMocks();
    (getClient as jest.Mock).mockReturnValue({ database: { getAccounts }, broadcast: { sendOperations } });
    (accountStorageService.getCurrentPostingKey as jest.Mock).mockResolvedValue('5Kposting');
    getAccounts.mockResolvedValue([account]);
    sendOperations.mockResolvedValue({ id: 'tx' });
});

it('reads the editable fields from chain', async () => {
    await expect(fetchProfileFields('meno')).resolves.toEqual({ ...EMPTY_PROFILE, name: 'Old' });
});

it('broadcasts account_update2 with merged posting metadata, signed with the posting key', async () => {
    const saved = await saveProfileFields('meno', { ...EMPTY_PROFILE, name: ' New ', website: 'snapie.io' });
    expect(saved).toEqual({ ...EMPTY_PROFILE, name: 'New', website: 'https://snapie.io' });

    const [[ops, key]] = sendOperations.mock.calls;
    expect(key).toBe('KEY');
    expect(ops).toHaveLength(1);
    const [name, body] = ops[0];
    expect(name).toBe('account_update2');
    expect(body).toEqual(expect.objectContaining({ account: 'meno', json_metadata: '', extensions: [] }));
    expect(body.memo_key).toBeUndefined();
    const meta = JSON.parse(body.posting_json_metadata);
    expect(meta.peakd).toEqual({ x: 1 });
    expect(meta.profile).toEqual(expect.objectContaining({ name: 'New', pinned: 'p', website: 'https://snapie.io', version: 2 }));
});

it('validates before touching the chain', async () => {
    await expect(saveProfileFields('meno', { ...EMPTY_PROFILE, website: 'nope' })).rejects.toThrow(/web address/);
    expect(getAccounts).not.toHaveBeenCalled();
    expect(sendOperations).not.toHaveBeenCalled();
});

it('needs a stored posting key', async () => {
    (accountStorageService.getCurrentPostingKey as jest.Mock).mockResolvedValue(null);
    await expect(saveProfileFields('meno', EMPTY_PROFILE)).rejects.toThrow(/posting key/);
    expect(sendOperations).not.toHaveBeenCalled();
});

it('signals a saved profile once', () => {
    expect(consumeProfileSaved('meno')).toBe(false);
    markProfileSaved('meno');
    expect(consumeProfileSaved('meno')).toBe(true);
    expect(consumeProfileSaved('meno')).toBe(false);
});
