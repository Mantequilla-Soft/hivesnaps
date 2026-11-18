/**
 * Tests for useFollowList: paging a followers / following list, ignoring a
 * stale page after a reset, and Follow / Unfollow from the list.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));
jest.mock('../../services/HiveFollowService', () => ({ broadcastFollow: jest.fn() }));
jest.mock('../../store/context', () => ({ useFollowCacheManagement: jest.fn() }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFollowList, type UseFollowListResult } from '../useFollowList';
import { getClient } from '../../services/HiveClient';
import { broadcastFollow } from '../../services/HiveFollowService';
import { useFollowCacheManagement } from '../../store/context';

const mockCall = jest.fn();
const mockBroadcast = broadcastFollow as jest.Mock;
const mockInvalidate = jest.fn();

/** Entries as get_followers / get_following return them. */
const followers = (names: string[]) => names.map((n) => ({ follower: n, following: 'alice', what: ['blog'] }));
const following = (names: string[]) => names.map((n) => ({ follower: 'me', following: n, what: ['blog'] }));
const page = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`);

interface Props { username: string; current: string | null; active: boolean }

function renderHook(props: Props) {
  const container: { result: UseFollowListResult } = { result: null as unknown as UseFollowListResult };
  const Test = (p: Props) => {
    container.result = useFollowList(p.username, 'followers', p.current, p.active);
    return null;
  };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Test, props)); });
  return { container, update: (p: Props) => act(() => { renderer.update(React.createElement(Test, p)); }) };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  jest.clearAllMocks();
  (getClient as jest.Mock).mockReturnValue({ call: mockCall });
  (useFollowCacheManagement as jest.Mock).mockReturnValue({ invalidateFollowingCache: mockInvalidate });
});

it('loads the first page, then the next one on loadMore', async () => {
  mockCall.mockImplementation(async (_api: string, method: string, params: unknown[]) => {
    if (method !== 'get_followers') return [];
    return params[1] === '' ? followers(page('a', 100)) : followers(page('b', 5));
  });
  const { container } = renderHook({ username: 'alice', current: null, active: true });
  await flush();
  expect(container.result.names).toHaveLength(100);
  expect(container.result.done).toBe(false);

  act(() => { container.result.loadMore(); });
  await flush();
  expect(container.result.names).toHaveLength(105);
  expect(container.result.done).toBe(true);
  expect(mockCall).toHaveBeenLastCalledWith('condenser_api', 'get_followers', ['alice', 'a099', 'blog', 100]);
});

it('ignores a slow page from the previous account after switching', async () => {
  let releaseOld!: (v: unknown) => void;
  mockCall.mockImplementation((_api: string, _method: string, params: unknown[]) =>
    params[0] === 'old'
      ? new Promise((r) => { releaseOld = r; })
      : Promise.resolve(followers(['newfan']))
  );
  const { container, update } = renderHook({ username: 'old', current: null, active: true });
  update({ username: 'new', current: null, active: true });
  await flush();
  releaseOld(followers(['oldfan']));
  await flush();
  expect(container.result.names).toEqual(['newfan']);
  expect(container.result.loading).toBe(false);
});

it('follows and unfollows, updating myFollowing and the cache', async () => {
  mockCall.mockImplementation(async (_api: string, method: string) =>
    method === 'get_following' ? following(['bob']) : followers(['bob', 'carol'])
  );
  mockBroadcast.mockResolvedValue(undefined);
  const { container } = renderHook({ username: 'alice', current: 'me', active: true });
  await flush();
  expect(container.result.myFollowing).toEqual(new Set(['bob']));

  await act(async () => { await container.result.toggleFollow('carol'); });
  expect(mockBroadcast).toHaveBeenLastCalledWith('me', 'carol', ['blog']);
  expect(container.result.myFollowing?.has('carol')).toBe(true);

  await act(async () => { await container.result.toggleFollow('bob'); });
  expect(mockBroadcast).toHaveBeenLastCalledWith('me', 'bob', []);
  expect(container.result.myFollowing?.has('bob')).toBe(false);
  expect(mockInvalidate).toHaveBeenCalledWith('me');
  expect(container.result.takeFollowChanged()).toBe(true);
  expect(container.result.takeFollowChanged()).toBe(false);
});

it('leaves myFollowing unchanged and rejects when the broadcast fails', async () => {
  mockCall.mockImplementation(async (_api: string, method: string) =>
    method === 'get_following' ? following([]) : followers(['carol'])
  );
  mockBroadcast.mockRejectedValue(new Error('No posting key found.'));
  const { container } = renderHook({ username: 'alice', current: 'me', active: true });
  await flush();

  await act(async () => {
    await expect(container.result.toggleFollow('carol')).rejects.toThrow('No posting key found.');
  });
  expect(container.result.myFollowing?.has('carol')).toBe(false);
  expect(container.result.pending.size).toBe(0);
  expect(container.result.takeFollowChanged()).toBe(false);
});
