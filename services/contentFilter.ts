/**
 * Content filters (hide by tag, app, or app + tag, plus presets like "Hide
 * game results"), shared with snapie.io through @snapie/content-filter and
 * synced to the account at https://snapie.io/api/user/content-filters.
 *
 * Replaces the old phone-only hashtag list (`hivesnaps_muted_tags`), which is
 * migrated into tag rules on first run.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContentFilterRemote,
  createContentFilterStore,
  fetchPresetCatalog,
} from '@snapie/content-filter';
import { getPointsAuthToken, jwtAccount } from './pointsAuthService';

const SNAPIE = 'https://snapie.io';
const LEGACY_TAGS_KEY = 'hivesnaps_muted_tags';
/** How long to wait for a snapie.io token before treating sync as unavailable. */
const TOKEN_TIMEOUT_MS = 10_000;
/** A sync request that hasn't answered by then is abandoned (and retried later). */
export const REQUEST_TIMEOUT_MS = 15_000;

export const contentFilterStore = createContentFilterStore({
  storage: AsyncStorage,
  readLegacyTags: async () => {
    const raw = await AsyncStorage.getItem(LEGACY_TAGS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  onError: err =>
    console.warn('[contentFilter]', err instanceof Error ? err.message : err),
});

/** The account a snapie.io JWT was issued for (its `sub`), or null if unreadable. */
export const tokenAccount = jwtAccount;

/** The current account's snapie.io token, or null after TOKEN_TIMEOUT_MS. */
function tokenWithTimeout(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
  });
  return Promise.race([getPointsAuthToken().catch(() => null), timeout]).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * Requests for `username`'s filters. A token issued for any other account is
 * refused: right after an account switch the previous account's cached token
 * can still be around, and using it would read or overwrite that account's
 * filters.
 */
export function makeFilterRequest(username: string, getToken: () => Promise<string | null> = tokenWithTimeout) {
  const account = username.toLowerCase();
  return async (path: string, init: RequestInit): Promise<Response | null> => {
    const token = await getToken();
    if (!token || tokenAccount(token) !== account) return null;
    // A hung request would otherwise keep the store "reconciling" and block
    // retries for this account until the OS gives up on it.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${SNAPIE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

let hydration: Promise<void> | null = null;

/** Reads the saved filters (and migrates the old hashtag list) once per app run. */
export function hydrateContentFilters(): Promise<void> {
  if (!hydration) {
    hydration = contentFilterStore.hydrate().catch(err => {
      hydration = null; // let a later call retry
      throw err;
    });
  }
  return hydration;
}

let catalogRequested = false;

/**
 * Sync filters for `username` (null = signed out: keep filtering locally,
 * stop syncing). Call on app start, login and account switch. Also fetches
 * the latest preset catalog once per app run, so new games can be hidden
 * without an app update.
 */
let lastSyncStart = 0;
/** Foreground re-syncs no more often than this. */
export const RESYNC_MIN_INTERVAL_MS = 60_000;

/**
 * Re-sync when the app returns to the foreground: picks up changes made on
 * snapie.io and retries a sync that failed (e.g. offline at launch). Skipped
 * if a sync started less than RESYNC_MIN_INTERVAL_MS ago.
 */
export function resyncContentFilters(username: string | null, now: number = Date.now()): Promise<void> | null {
  if (!username || now - lastSyncStart < RESYNC_MIN_INTERVAL_MS) return null;
  return startContentFilterSync(username);
}

export async function startContentFilterSync(username: string | null): Promise<void> {
  lastSyncStart = Date.now();
  // Local filters first, so the first sync merges with what's on the phone.
  await hydrateContentFilters().catch(() => undefined);
  if (!catalogRequested) {
    catalogRequested = true;
    void fetchPresetCatalog(SNAPIE)
      .then(catalog => {
        if (catalog) contentFilterStore.setCatalog(catalog);
        else catalogRequested = false; // retry on the next call
      })
      .catch(() => {
        catalogRequested = false;
      });
  }
  const remote = username ? createContentFilterRemote(makeFilterRequest(username)) : null;
  return contentFilterStore.setSyncUser(username, remote);
}
