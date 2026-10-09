/**
 * Tests for useBlogFeed — verifies the fix for #244: the hook must carry
 * bridge.get_ranked_posts' `active_votes` (voter list) through to BlogPost,
 * derive net_votes when the bridge omits it, and patch the voted state in
 * place when useUpvote emits a post-voted event after a broadcast.
 */

jest.mock('../../services/HiveClient', () => ({
  getClient: jest.fn(),
}));

jest.mock('../../services/AvatarService', () => ({
  avatarService: {
    getAvatarUrl: jest.fn(),
  },
}));

jest.mock('@ecency/render-helper', () => ({
  catchPostImage: jest.fn(() => null),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useBlogFeed, UseBlogFeedResult, BlogPost } from '../useBlogFeed';
import { getClient } from '../../services/HiveClient';
import { avatarService } from '../../services/AvatarService';
import { emitPostVoted, POST_VOTED_TTL_MS } from '../../utils/globalEvents';

const mockCall = jest.fn();
(getClient as jest.Mock).mockReturnValue({ call: mockCall });
const mockGetAvatarUrl = avatarService.getAvatarUrl as jest.Mock;

// `container` is mutated in place on every re-render, so callers must read
// `container.result` fresh after each `act()` (same convention as
// useWavesFeed.test.tsx).
function renderUseBlogFeed(): { result: UseBlogFeedResult } {
  const container: { result: UseBlogFeedResult } = { result: null as unknown as UseBlogFeedResult };
  const TestComponent = () => { container.result = useBlogFeed(); return null; };
  act(() => { create(React.createElement(TestComponent)); });
  return container;
}

/** Raw bridge.get_ranked_posts shape: voter list has rshares, NO percent, NO net_votes */
function rawBridgePost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    author: 'paultactico2',
    permlink: 'retrogaming-fighting-in-the-73',
    title: 'A post',
    body: 'Some body text',
    json_metadata: '{}',
    created: '2026-10-01T12:00:00',
    pending_payout_value: '1.234 HBD',
    total_payout_value: '0.000 HBD',
    children: 1,
    active_votes: [
      { voter: 'jza', rshares: 5856255498 },
      { voter: 'meno', rshares: 2389866260606 },
    ],
    ...overrides,
  };
}

// Fake clock: each test starts far past the replay TTL so votes emitted by
// earlier tests (module-level replay buffer) have expired.
let now = 0;
jest.spyOn(Date, 'now').mockImplementation(() => now);

describe('useBlogFeed', () => {
  beforeEach(() => {
    now += 10 * POST_VOTED_TTL_MS;
    jest.clearAllMocks();
    mockGetAvatarUrl.mockResolvedValue({ url: 'https://images.hive.blog/u/x/avatar', fromCache: false, source: 'fallback' });
  });

  it('carries active_votes through to BlogPost', async () => {
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    expect(hook.result.posts).toHaveLength(1);
    expect(hook.result.posts[0].active_votes).toEqual([
      { voter: 'jza', rshares: 5856255498 },
      { voter: 'meno', rshares: 2389866260606 },
    ]);
    expect(hook.result.loading).toBe(false);
    expect(hook.result.error).toBeNull();
  });

  it('derives net_votes from the voter list when the bridge omits it', async () => {
    mockCall.mockResolvedValueOnce([
      rawBridgePost({
        active_votes: [
          { voter: 'jza', rshares: 100 },
          { voter: 'meno', rshares: -50 }, // downvote
          { voter: 'kid', rshares: 5 },
        ],
      }),
    ]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    // 2 upvotes − 1 downvote; bridge payload has no net_votes field at all
    expect(hook.result.posts[0].net_votes).toBe(1);
  });

  it('defaults active_votes to [] when the API omits it', async () => {
    mockCall.mockResolvedValueOnce([rawBridgePost({ active_votes: undefined })]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    expect(hook.result.posts[0].active_votes).toEqual([]);
    expect(hook.result.posts[0].net_votes).toBe(0);
  });

  it('reconciles a vote that lands while a refetch is in flight', async () => {
    let resolveCall!: (value: unknown[]) => void;
    mockCall.mockImplementationOnce(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveCall = resolve;
        })
    );

    const hook = renderUseBlogFeed();
    const fetchPromise = hook.result.fetchPosts();

    // A successful vote lands while the API response is still pending
    act(() => {
      emitPostVoted({
        author: 'paultactico2',
        permlink: 'retrogaming-fighting-in-the-73',
        voter: 'carol',
        percent: 10000,
      });
    });

    // The in-flight fetch returns a stale payload missing carol's vote
    await act(async () => {
      resolveCall([rawBridgePost()]);
      await fetchPromise;
    });

    // The stale commit must not clobber the optimistic vote patch
    const post = hook.result.posts[0];
    expect(post.active_votes.some(v => v.voter === 'carol')).toBe(true);
    expect(post.net_votes).toBe(3);
  });

  it('patches the matching post in place when a post-voted event fires', async () => {
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    const before: BlogPost = hook.result.posts[0];
    expect(before.net_votes).toBe(2);

    act(() => {
      emitPostVoted({
        author: 'paultactico2',
        permlink: 'retrogaming-fighting-in-the-73',
        voter: 'carol',
        percent: 10000,
      });
    });

    const after = hook.result.posts[0];
    // Voter appended (bridge entries carry no percent — the new entry does)
    expect(after.active_votes).toHaveLength(3);
    expect(after.active_votes[2]).toEqual({ voter: 'carol', percent: 10000, rshares: 0 });
    expect(after.net_votes).toBe(3);
    // Same object identity for untouched posts / no refetch happened
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('does not double-count when the voter already upvoted', async () => {
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    act(() => {
      emitPostVoted({
        author: 'paultactico2',
        permlink: 'retrogaming-fighting-in-the-73',
        voter: 'meno', // already an upvote in the bridge payload
        percent: 10000,
      });
    });

    const after = hook.result.posts[0];
    expect(after.active_votes).toHaveLength(2); // replaced, not appended
    expect(after.net_votes).toBe(2); // unchanged
  });

  it('ignores post-voted events for other posts', async () => {
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    const before = hook.result.posts;
    act(() => {
      emitPostVoted({ author: 'someone-else', permlink: 'other-post', voter: 'carol', percent: 10000 });
    });

    expect(hook.result.posts).toBe(before); // same reference — no state churn
  });

  const carolVote = {
    author: 'paultactico2',
    permlink: 'retrogaming-fighting-in-the-73',
    voter: 'carol',
    percent: 10000,
  };

  it('applies a vote cast before the feed mounted, even if the fetch omits it', async () => {
    act(() => { emitPostVoted(carolVote); });
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    expect(hook.result.posts[0].active_votes.some(v => v.voter === 'carol')).toBe(true);
    expect(hook.result.posts[0].net_votes).toBe(3);
  });

  it('does not replay a vote older than the TTL to a new feed', async () => {
    act(() => { emitPostVoted(carolVote); });
    now += POST_VOTED_TTL_MS + 1;
    mockCall.mockResolvedValueOnce([rawBridgePost()]);

    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });

    expect(hook.result.posts[0].net_votes).toBe(2);
  });

  it('stops re-applying a pending vote on refresh once the TTL passes', async () => {
    mockCall.mockResolvedValue([rawBridgePost()]);
    const hook = renderUseBlogFeed();
    await act(async () => { await hook.result.fetchPosts(); });
    act(() => { emitPostVoted(carolVote); });
    await act(async () => { await hook.result.fetchPosts(); });
    expect(hook.result.posts[0].net_votes).toBe(3); // still within TTL

    now += POST_VOTED_TTL_MS + 1;
    await act(async () => { await hook.result.fetchPosts(); });
    expect(hook.result.posts[0].net_votes).toBe(2); // chain data wins
  });
});
