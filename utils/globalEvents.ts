// Lightweight in-memory global event subscription for app-wide signals
// Keep implementation tiny to avoid adding dependencies. Consumers can
// subscribe to the global refresh event and will receive a call when
// `emitGlobalRefresh()` is invoked.

type Callback = () => void;
const globalRefreshSubscribers = new Set<Callback>();

export function subscribeGlobalRefresh(cb: Callback): () => void {
  globalRefreshSubscribers.add(cb);
  return () => globalRefreshSubscribers.delete(cb);
}

export function unsubscribeGlobalRefresh(cb: Callback): void {
  globalRefreshSubscribers.delete(cb);
}

export function emitGlobalRefresh(): void {
  // Fire-and-forget; guard each subscriber with try/catch
  for (const cb of Array.from(globalRefreshSubscribers)) {
    try {
      cb();
    } catch (err) {
      // swallow per-subscriber errors to avoid interrupting others
      try { console.error('[globalEvents] subscriber error', err); } catch {}
    }
  }
}

// --- Post-voted event -----------------------------------------------------
// Fired after a vote broadcast succeeds so any mounted feed can patch its own
// copy of the post (the blog feed renders once per session and has no other
// way to learn about a vote cast on HivePostScreen). Same tiny Set-based
// pattern as the refresh event above.

export interface PostVotedEvent {
  author: string;
  permlink: string;
  voter: string;
  percent: number; // Hive hundredths (e.g. 10000 = 100%)
}

type PostVotedCallback = (event: PostVotedEvent) => void;
const postVotedSubscribers = new Set<PostVotedCallback>();

export function subscribePostVoted(cb: PostVotedCallback): () => void {
  postVotedSubscribers.add(cb);
  return () => postVotedSubscribers.delete(cb);
}

export function emitPostVoted(event: PostVotedEvent): void {
  for (const cb of Array.from(postVotedSubscribers)) {
    try {
      cb(event);
    } catch (err) {
      try { console.error('[globalEvents] postVoted subscriber error', err); } catch {}
    }
  }
}


