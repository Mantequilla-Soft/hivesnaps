/**
 * OrderedContainerMap capacity policy: replacing a held container is always
 * allowed, and a new latest container at capacity drops the oldest one
 * instead of being lost.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn(() => ({})) }));
jest.mock('../../store/context', () => ({
    useFollowingList: jest.fn(),
    useMutedList: jest.fn(),
    useCurrentUser: jest.fn(),
}));
jest.mock('../../services/AvatarService', () => ({ avatarService: {} }));
jest.mock('../../services/ModerationService', () => ({ ModerationService: {} }));
jest.mock('../../services/HiveMuteService', () => ({ fetchMutedList: jest.fn(), didLastMutedListFetchFail: jest.fn() }));
jest.mock('../usePatronList', () => ({ usePatronList: jest.fn() }));

import { OrderedContainerMap } from '../useFeedData';

const container = (permlink: string, snaps: number) => ({
    permlink,
    snaps: Array.from({ length: snaps }, (_, i) => ({
        author: `a${i}`,
        permlink: `${permlink}-${i}`,
        parent_author: 'peak.snaps',
        parent_permlink: permlink,
        body: '',
        created: '2026-11-19T00:00:00',
    })),
    created: '2026-11-19T00:00:00',
    author: 'peak.snaps',
    fetchedAt: 0,
});

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function fullMap(): OrderedContainerMap {
    const map = new OrderedContainerMap(3);
    map.set('c3', container('c3', 1)); // newest
    map.set('c2', container('c2', 1));
    map.set('c1', container('c1', 1)); // oldest
    return map;
}

it('replaces a container it already holds even at capacity', () => {
    const map = fullMap();
    map.set('c3', container('c3', 5));
    expect(map.getKeys()).toEqual(['c3', 'c2', 'c1']);
    expect(map.containers.get('c3')?.snaps).toHaveLength(5);
});

it('still refuses a brand-new key via set at capacity', () => {
    const map = fullMap();
    map.set('c0', container('c0', 1));
    expect(map.getKeys()).toEqual(['c3', 'c2', 'c1']);
});

it('prepends a new latest container at capacity by dropping the oldest', () => {
    const map = fullMap();
    map.prepend('c4', container('c4', 2));
    expect(map.getKeys()).toEqual(['c4', 'c3', 'c2']);
});

it('prepend of a held key updates it in place', () => {
    const map = fullMap();
    map.prepend('c2', container('c2', 7));
    expect(map.getKeys()).toEqual(['c3', 'c2', 'c1']);
    expect(map.containers.get('c2')?.snaps).toHaveLength(7);
});
