/**
 * Tests for shortsService — parses 3Speak's checker.3speak.tv/shortssorted
 * response into ShortItem[]. Field names/shapes here (data.shorts, bare
 * "author/permlink" embed_url, page/totalPages) are confirmed against
 * snapie-io's own hooks/useShorts.ts source, not guessed — a first pass
 * had assumed embed_url was a full URL, which silently dropped every
 * entry against the real API. These tests pin down the corrected shape,
 * plus some extra tolerance for plausible alternate key names.
 */

import { fetchShortsPage } from '../shortsService';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('fetchShortsPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('parses the real shape: data.shorts with a bare "author/permlink" embed_url', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        shorts: [
          {
            embed_url: 'alice/my-video',
            permlink: 'my-video',
            thumbnail_url: 'https://img.example/thumb.jpg',
            hive_title: 'My First Short',
            views: 42,
            createdAt: '2026-01-01T00:00:00',
          },
        ],
        page: 1,
        totalPages: 3,
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');

    expect(result.items).toEqual([
      {
        id: 'alice/my-video',
        author: 'alice',
        permlink: 'my-video',
        hivePermlink: 'my-video',
        thumbnailUrl: 'https://img.example/thumb.jpg',
        title: 'My First Short',
        views: 42,
        createdAt: '2026-01-01T00:00:00',
      },
    ]);
    expect(result.hasMore).toBe(true);
  });

  it('strips a leading @ from embed_url before splitting on the first slash', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        shorts: [{ embed_url: '@bob/short-2', permlink: 'short-2', embed_title: 'Bob short' }],
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items[0].author).toBe('bob');
    expect(result.items[0].hivePermlink).toBe('short-2');
  });

  it('falls back to the top-level owner field when embed_url has no author segment', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        shorts: [{ embed_url: '', owner: 'carol', permlink: 'vid-3', title: 'Carol title' }],
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items[0]).toMatchObject({ author: 'carol', permlink: 'vid-3' });
  });

  it('falls back to a bare root array when there is no wrapper object', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ embed_url: 'dave/vid-4', permlink: 'vid-4', embed_title: 'Dave short' }])
    );

    const result = await fetchShortsPage(1, 'seed-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].author).toBe('dave');
    expect(result.items[0].title).toBe('Dave short');
  });

  it('accepts alternate key names for common fields', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            embedUrl: 'erin/vid-5',
            permlink: 'vid-5',
            thumbnailUrl: 'https://img.example/erin.jpg',
            title: 'Erin title',
            view_count: 7,
          },
        ],
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items[0]).toMatchObject({
      author: 'erin',
      permlink: 'vid-5',
      thumbnailUrl: 'https://img.example/erin.jpg',
      title: 'Erin title',
      views: 7,
    });
  });

  it('drops entries with no author at all (no embed_url and no owner)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ shorts: [{ permlink: 'vid-6', thumbnail_url: 'https://img.example/orphan.jpg' }] })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items).toEqual([]);
  });

  it('drops entries with no 3Speak permlink, since there is nothing to play', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ shorts: [{ embed_url: 'frank/vid-7' }] }));

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items).toEqual([]);
  });

  it('hasMore matches page < totalPages exactly, defaulting both to 1 when absent', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ shorts: [] }));
    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.hasMore).toBe(false); // 1 < 1 is false, same as snapie-io's default
  });

  it('throws when the request fails', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null, false, 503));
    await expect(fetchShortsPage(1, 'seed-1')).rejects.toThrow('503');
  });

  it('builds the request URL with page, seed, and limit', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ shorts: [] }));
    await fetchShortsPage(2, 'my-seed', 15);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://checker.3speak.tv/shortssorted?page=2&limit=15&seed=my-seed',
      expect.any(Object)
    );
  });
});
