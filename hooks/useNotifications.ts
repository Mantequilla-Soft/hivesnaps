import { useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import { PrivateKey } from '@hiveio/dhive';

import {
  fetchNotifications,
  fetchUnreadNotificationState,
  broadcastSetLastRead,
  parseNotification,
  applyReadCursor,
  sortNotifications,
  getDefaultNotificationSettings,
  filterNotificationsBySettings,
  parseHiveDate,
  type ParsedNotification,
} from '../utils/notifications';

import { useMutedList, useNotifications as useNotificationStore } from '../store/context';
import { fetchMutedList, didLastMutedListFetchFail } from '../services/HiveMuteService';
import { CACHE_DURATIONS } from '../store/types';
import { getClient } from '../services/HiveClient';
import { accountStorageService } from '../services/AccountStorageService';

const PAGE_SIZE = 50;
const EPOCH = '1970-01-01T00:00:00';

interface UseNotificationsResult {
  notifications: ParsedNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  settings: ReturnType<typeof getDefaultNotificationSettings>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (
    newSettings: Partial<ReturnType<typeof getDefaultNotificationSettings>>
  ) => void;
}

const STORAGE_KEYS = {
  SETTINGS: 'notification_settings',
};

export const useNotifications = (
  username: string | null
): UseNotificationsResult => {
  const [notifications, setNotifications] = useState<ParsedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(getDefaultNotificationSettings());
  // Hive's own read cursor (bridge.unread_notifications) — the source of
  // truth for read/unread, shared with every other Hive frontend.
  const [lastRead, setLastRead] = useState(EPOCH);

  // Get store's setNotificationUnreadCount to update bell badge
  const { setNotificationUnreadCount } = useNotificationStore();

  // Use shared state for muted list (same pattern as FeedScreen)
  const {
    mutedList,
    needsRefresh: needsMutedRefresh,
    setMutedList,
    setLoading: setMutedLoading,
    setError: setMutedError,
  } = useMutedList(username || '');

  // Ensure muted list is loaded. Checks only cache presence/staleness, never
  // list length — a genuinely (or persistently, e.g. no auth session yet)
  // empty list is still a validly cached result. fetchMutedList never
  // throws (it catches internally and resolves to an empty Set), so on any
  // failure this still calls setMutedList([]), which creates a NEW array
  // reference every time; if length===0 were part of the guard, that new
  // reference would make this callback's identity change on every call,
  // re-firing the effect below forever — a real infinite loop this hook
  // used to have, surfaced by an auth-required backend call always
  // resolving empty before a session exists.
  const ensureMutedListLoaded = useCallback(async () => {
    if (!username) return;

    if (!mutedList || needsMutedRefresh) {
      try {
        setMutedLoading(true);
        const mutedSet = await fetchMutedList(username);
        // A failed fetch shouldn't be cached here as if it were confirmed
        // for a full day — use a short retry lifetime instead.
        setMutedList(
          Array.from(mutedSet),
          didLastMutedListFetchFail(username) ? CACHE_DURATIONS.MUTED_LIST_RETRY : undefined
        );
        setMutedError(null);
      } catch (error) {
        console.error('[useNotifications] Error loading muted list:', error);
        setMutedError(error instanceof Error ? error.message : 'Failed to load muted list');
      } finally {
        setMutedLoading(false);
      }
    }
  }, [username, mutedList, needsMutedRefresh, setMutedList, setMutedLoading, setMutedError]);

  useEffect(() => {
    ensureMutedListLoaded();
  }, [ensureMutedListLoaded]);

  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef<number>(0);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReadRef = useRef(lastRead);
  lastReadRef.current = lastRead;
  // Synchronous guard for loadMore — FlatList can call onEndReached again
  // before React commits setLoadingMore(true), so the `loadingMore` state
  // alone can't stop a duplicate fetch. listGenRef lets an in-flight
  // loadMore detect that refresh() replaced the list underneath it and
  // discard its (now stale) page instead of appending onto the fresh list.
  const loadingMoreRef = useRef(false);
  const listGenRef = useRef(0);

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await SecureStore.getItemAsync(
          STORAGE_KEYS.SETTINGS
        );
        if (storedSettings) {
          setSettings({
            ...getDefaultNotificationSettings(),
            ...JSON.parse(storedSettings),
          });
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = useCallback(
    async (
      newSettings: Partial<ReturnType<typeof getDefaultNotificationSettings>>
    ) => {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      try {
        await SecureStore.setItemAsync(
          STORAGE_KEYS.SETTINGS,
          JSON.stringify(updatedSettings)
        );
      } catch (error) {
        console.error('Error saving notification settings:', error);
      }
    },
    [settings]
  );

  // Fetch + filter a single page (mute list + user settings), unsorted-safe
  const fetchAndFilterPage = useCallback(
    async (lastId?: number): Promise<{ items: ParsedNotification[]; rawCount: number }> => {
      if (!username) return { items: [], rawCount: 0 };

      const raw = await fetchNotifications(username, PAGE_SIZE, lastId);
      const parsed = raw.map(parseNotification);

      const notMuted = parsed.filter(n => {
        if (!n.actionUser) return true;
        return !(mutedList && mutedList.includes(n.actionUser));
      });

      const filtered = filterNotificationsBySettings(notMuted, settings);
      return { items: filtered, rawCount: raw.length };
    },
    [username, settings, mutedList]
  );

  // Pull Hive's read cursor and push it into local state + the bell badge.
  // Never regresses lastRead — guards against a stale response landing
  // after markAllAsRead already moved it forward.
  // Returns the cursor that ends up in effect (fresh or, on failure/regression,
  // whatever was already current) — callers use the return value directly
  // instead of re-reading lastReadRef right after, since a state update from
  // setLastRead here isn't visible on the ref until the next render.
  const fetchUnread = useCallback(async (): Promise<string> => {
    if (!username) return lastReadRef.current;
    try {
      const state = await fetchUnreadNotificationState(username);
      if (parseHiveDate(state.lastread) >= parseHiveDate(lastReadRef.current)) {
        setLastRead(state.lastread);
        setNotificationUnreadCount(state.unread || 0);
        return state.lastread;
      }
      return lastReadRef.current;
    } catch {
      // Unread state is nice-to-have; the list can still render without it.
      return lastReadRef.current;
    }
  }, [username, setNotificationUnreadCount]);

  const refresh = useCallback(
    async (isManualRefresh = false) => {
      if (!username) return;

      // Prevent too frequent API calls (minimum 30 seconds between automatic calls)
      const now = Date.now();
      if (!isManualRefresh && now - lastFetchTime.current < 30000) {
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else if (notifications.length === 0) {
        setLoading(true);
      }

      setError(null);

      try {
        const [{ items, rawCount }, freshLastRead] = await Promise.all([
          fetchAndFilterPage(),
          fetchUnread(),
        ]);

        // Bump before replacing the list so a loadMore in flight from the
        // list this is about to replace can tell its page is now stale.
        listGenRef.current += 1;
        const withReadStatus = applyReadCursor(items, freshLastRead);
        setNotifications(sortNotifications(withReadStatus, 'chronological'));
        setHasMore(rawCount >= PAGE_SIZE);

        lastFetchTime.current = now;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load notifications';
        setError(errorMessage);
        console.error('Error refreshing notifications:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [username, notifications.length, fetchAndFilterPage, fetchUnread]
  );

  const loadMore = useCallback(async () => {
    if (!username || loadingMoreRef.current || !hasMore) return;

    const oldestId = notifications[notifications.length - 1]?.id;
    if (oldestId === undefined) return;

    loadingMoreRef.current = true;
    const gen = listGenRef.current;
    setLoadingMore(true);
    setError(null);

    try {
      const { items, rawCount } = await fetchAndFilterPage(oldestId);
      // refresh() replaced the list while this page was in flight — that
      // page belongs to a list this hook no longer shows, so drop it
      // instead of appending an older page onto the fresh one.
      if (gen !== listGenRef.current) return;

      const withReadStatus = applyReadCursor(items, lastReadRef.current);

      setNotifications(prev => {
        const seen = new Set(prev.map(n => n.id));
        const merged = [...prev, ...withReadStatus.filter(n => !seen.has(n.id))];
        return sortNotifications(merged, 'chronological');
      });
      setHasMore(rawCount >= PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more notifications');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [username, hasMore, notifications, fetchAndFilterPage]);

  const getPostingKey = useCallback(async (): Promise<PrivateKey> => {
    const keyStr = await accountStorageService.getCurrentPostingKey();
    if (!keyStr) throw new Error('No posting key found. Please log in again.');
    return PrivateKey.fromString(keyStr);
  }, []);

  // Marks everything through this notification's date as read — the same
  // "read up to here" semantics every Hive frontend uses, broadcast as a
  // real transaction so it's visible from any other app too.
  const markAsRead = useCallback(
    async (notificationId: number) => {
      if (!username) return;
      const target = notifications.find(n => n.id === notificationId);
      if (!target) return;
      if (parseHiveDate(target.date) <= parseHiveDate(lastReadRef.current)) return; // already read

      const postingKey = await getPostingKey();
      await broadcastSetLastRead(getClient(), username, postingKey, target.date);

      setLastRead(target.date);
      setNotifications(prev => applyReadCursor(prev, target.date));
      await fetchUnread();
    },
    [username, notifications, getPostingKey, fetchUnread]
  );

  const markAllAsRead = useCallback(async () => {
    if (!username) return;
    const hadUnread = notifications.some(n => !n.read);
    if (!hadUnread) return;

    // Hive's own date format has no trailing 'Z' — match it so the value
    // round-trips through bridge.unread_notifications correctly.
    const throughDate = new Date().toISOString().replace('Z', '');

    const postingKey = await getPostingKey();
    await broadcastSetLastRead(getClient(), username, postingKey, throughDate);

    setLastRead(throughDate);
    setNotifications(prev => applyReadCursor(prev, throughDate));
    setNotificationUnreadCount(0);
  }, [username, notifications, getPostingKey, setNotificationUnreadCount]);

  // Get unread count from store (source of truth — Hive's own count,
  // written here whenever we fetch or mark read)
  const { unreadCount } = useNotificationStore();

  // Set up automatic refresh when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        refresh(false);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [refresh]);

  // Set up periodic refresh when app is active
  useEffect(() => {
    if (!username) return;

    refresh(false);

    refreshInterval.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        refresh(false);
      }
    }, 120000); // 2 minutes

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [username, refresh]);

  // Re-filter existing (already-fetched) notifications when settings change
  useEffect(() => {
    if (username && notifications.length > 0) {
      const filtered = filterNotificationsBySettings(notifications, settings);
      setNotifications(sortNotifications(filtered, 'chronological'));
    }
    // Only re-run when settings change — notifications is intentionally
    // excluded to avoid re-filtering an already-filtered list in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    settings,
    refresh: () => refresh(true),
    loadMore,
    markAsRead,
    markAllAsRead,
    updateSettings,
  };
};
