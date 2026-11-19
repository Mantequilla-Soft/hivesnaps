jest.mock('../HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../AccountStorageService', () => ({ accountStorageService: { getCurrentPostingKey: jest.fn() } }));
jest.mock('@hiveio/dhive', () => ({ PrivateKey: { fromString: jest.fn(() => 'KEY') } }));

import { broadcastFollow, broadcastReblog, fetchRebloggedBy } from '../HiveFollowService';
import { getClient } from '../HiveClient';
import { accountStorageService } from '../AccountStorageService';

const mockJson = jest.fn();
const mockDbCall = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (getClient as jest.Mock).mockReturnValue({ broadcast: { json: mockJson }, database: { call: mockDbCall } });
    (accountStorageService.getCurrentPostingKey as jest.Mock).mockResolvedValue('5Kposting');
});

it('reblog is a `follow` custom_json with a reblog payload, signed by the posting key', async () => {
    await broadcastReblog('me', 'alice', 'post-1');
    expect(mockJson).toHaveBeenCalledWith(
        {
            required_auths: [],
            required_posting_auths: ['me'],
            id: 'follow',
            json: JSON.stringify(['reblog', { account: 'me', author: 'alice', permlink: 'post-1' }]),
        },
        'KEY'
    );
});

it('follow keeps its payload', async () => {
    await broadcastFollow('me', 'alice', ['blog']);
    expect(JSON.parse(mockJson.mock.calls[0][0].json)).toEqual(['follow', { follower: 'me', following: 'alice', what: ['blog'] }]);
});

it('refuses to broadcast without a posting key', async () => {
    (accountStorageService.getCurrentPostingKey as jest.Mock).mockResolvedValue(null);
    await expect(broadcastReblog('me', 'alice', 'post-1')).rejects.toThrow('No posting key');
    expect(mockJson).not.toHaveBeenCalled();
});

it('fetchRebloggedBy returns accounts, or [] on failure', async () => {
    mockDbCall.mockResolvedValueOnce(['bob', 3, 'carol']);
    expect(await fetchRebloggedBy('alice', 'p')).toEqual(['bob', 'carol']);
    expect(mockDbCall).toHaveBeenCalledWith('get_reblogged_by', ['alice', 'p']);
    mockDbCall.mockRejectedValueOnce(new Error('down'));
    expect(await fetchRebloggedBy('alice', 'p')).toEqual([]);
});
