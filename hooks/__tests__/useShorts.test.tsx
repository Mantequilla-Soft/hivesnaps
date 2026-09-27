/**
 * Tests for useShorts — pages through shortsService's checker.3speak.tv
 * feed, filters out muted authors, dedupes repeats across pages, and
 * enriches each item with an avatar URL.
 */

jest.mock('../../services/shortsService', () => ({
  fetchShortsPage: jest.fn(),
}));

jest.mock('../../services/HiveMuteService', () => ({
  fetchMutedList: jest.fn(),
}));

jest.mock('../../services/AvatarService', () => ({
  avatarService: {
    getAvatarUrl: jest.fn(),
  },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useShorts, UseShortsResult } from '../useShorts';
import { fetchShortsPage } from '../../services/shortsService';
import { fetchMutedList } from '../../services/HiveMuteService';
import { avatarService } from '../../services/AvatarService';

const mockFetchShortsPage = fetchShortsPage as jest.Mock;
const mockFetchMutedList = fetchMutedList as jest.Mock;
const mockGetAvatarUrl = avatarService.getAvatarUrl as jest.Mock;

function renderUseShorts(username: string | null = 'alice'): { result: UseShortsResult } {
  const container: { result: UseShortsResult } = { result: null as unknown as UseShortsResult };
  const TestComponent = () => {
    container.result = useShorts(username);
    return null;
  };
  act(() => {
    create(React.createElement(TestComponent));
  });
  return container;
}

function shortItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'author-1/perm-1',
    author: 'author-1',
    permlink: 'perm-1',
    hivePermlink: 'perm-1',
    thumbnailUrl: 'https://img.example/1.jpg',
    title: 'A short',
    views: 10,
    createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('useShorts', () => {
  beforeEach(() => {
    mockFetchShortsPage.mockReset();
    mockFetchMutedList.mockReset();
    mockGetAvatarUrl.mockReset();
    mockFetchMutedList.mockResolvedValue(new Set());
    mockGetAvatarUrl.mockResolvedValue({ url: 'https://avatar.example/x.jpg' });
  });

  it('loads the first page, applies the muted-account filter, and enriches with avatars', async () => {
    mockFetchMutedList.mockResolvedValueOnce(new Set(['muted-author']));
    mockFetchShortsPage.mockResolvedValueOnce({
      items: [
        shortItem({ id: 'a/1', author: 'a' }),
        shortItem({ id: 'muted-author/2', author: 'muted-author' }),
      ],
      hasMore: true,
    });

    const container = renderUseShorts('alice');
    await act(async () => {
      await container.result.fetchShorts();
    });

    expect(container.result.shorts.map(s => s.author)).toEqual(['a']);
    expect(container.result.shorts[0].avatarUrl).toBe('https://avatar.example/x.jpg');
    expect(container.result.hasMore).toBe(true);
    expect(container.result.loading).toBe(false);
  });

  it('dedupes items that reappear across pages', async () => {
    mockFetchShortsPage
      .mockResolvedValueOnce({ items: [shortItem({ id: 'a/1', author: 'a' })], hasMore: true })
      .mockResolvedValueOnce({
        items: [shortItem({ id: 'a/1', author: 'a' }), shortItem({ id: 'b/2', author: 'b' })],
        hasMore: false,
      });

    const container = renderUseShorts('alice');
    await act(async () => {
      await container.result.fetchShorts();
    });
    await act(async () => {
      await container.result.loadMore();
    });

    expect(container.result.shorts.map(s => s.id)).toEqual(['a/1', 'b/2']);
  });

  it('does not call fetchMutedList for a logged-out viewer, but still loads community content', async () => {
    mockFetchShortsPage.mockResolvedValueOnce({ items: [shortItem()], hasMore: false });

    const container = renderUseShorts(null);
    await act(async () => {
      await container.result.fetchShorts();
    });

    expect(mockFetchMutedList).not.toHaveBeenCalled();
    expect(container.result.shorts).toHaveLength(1);
  });

  it('surfaces an error and leaves the list empty when the page fetch fails', async () => {
    mockFetchShortsPage.mockRejectedValueOnce(new Error('network down'));

    const container = renderUseShorts('alice');
    await act(async () => {
      await container.result.fetchShorts();
    });

    expect(container.result.error).toBe('network down');
    expect(container.result.shorts).toEqual([]);
    expect(container.result.loading).toBe(false);
  });

  it('removeAuthor strips every short from that author immediately', async () => {
    mockFetchShortsPage.mockResolvedValueOnce({
      items: [
        shortItem({ id: 'a/1', author: 'a' }),
        shortItem({ id: 'a/2', author: 'a', permlink: 'perm-2' }),
        shortItem({ id: 'b/1', author: 'b' }),
      ],
      hasMore: false,
    });

    const container = renderUseShorts('alice');
    await act(async () => {
      await container.result.fetchShorts();
    });
    expect(container.result.shorts).toHaveLength(3);

    act(() => {
      container.result.removeAuthor('A');
    });

    expect(container.result.shorts.map(s => s.author)).toEqual(['b']);
  });

  it('refresh reshuffles by re-fetching page 1 and resets the dedup set', async () => {
    mockFetchShortsPage
      .mockResolvedValueOnce({ items: [shortItem({ id: 'a/1', author: 'a' })], hasMore: false })
      .mockResolvedValueOnce({ items: [shortItem({ id: 'a/1', author: 'a' })], hasMore: false });

    const container = renderUseShorts('alice');
    await act(async () => {
      await container.result.fetchShorts();
    });
    await act(async () => {
      await container.result.refresh();
    });

    // Same item id is allowed back in after a refresh resets seenKeys.
    expect(container.result.shorts.map(s => s.id)).toEqual(['a/1']);
    expect(mockFetchShortsPage).toHaveBeenCalledTimes(2);
  });
});
