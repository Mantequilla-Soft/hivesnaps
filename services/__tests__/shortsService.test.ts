/**
 * Tests for shortsService — parses 3Speak's checker.3speak.tv/shortssorted
 * response into ShortItem[]. The exact response envelope wasn't verifiable
 * live (network-restricted dev environment), so parsing tolerates several
 * plausible key names/shapes — these tests pin down that tolerance.
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

  it('parses a "shorts" keyed envelope with page/totalPages', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        shorts: [
          {
            embed_url: 'https://play.3speak.tv/embed?v=alice/my-video',
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

  it('falls back to a bare root array when there is no wrapper object', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { embed_url: 'https://play.3speak.tv/embed?v=bob/short-2', embed_title: 'Bob short' },
      ])
    );

    const result = await fetchShortsPage(1, 'seed-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].author).toBe('bob');
    expect(result.items[0].title).toBe('Bob short');
    // No page/totalPages info to consult — a non-empty page is treated as
    // "there might be more," stopping only once a page comes back empty.
    expect(result.hasMore).toBe(true);
  });

  it('accepts alternate key names for common fields', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            embedUrl: 'https://play.3speak.tv/embed?v=carol/vid-3',
            thumbnailUrl: 'https://img.example/carol.jpg',
            title: 'Carol title',
            view_count: 7,
          },
        ],
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items[0]).toMatchObject({
      author: 'carol',
      permlink: 'vid-3',
      thumbnailUrl: 'https://img.example/carol.jpg',
      title: 'Carol title',
      views: 7,
    });
  });

  it('drops entries with no usable embed URL rather than throwing', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        shorts: [{ thumbnail_url: 'https://img.example/orphan.jpg' }],
      })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items).toEqual([]);
  });

  it('drops entries whose embed URL has no v= query param', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ shorts: [{ embed_url: 'https://play.3speak.tv/embed' }] })
    );

    const result = await fetchShortsPage(1, 'seed-1');
    expect(result.items).toEqual([]);
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
