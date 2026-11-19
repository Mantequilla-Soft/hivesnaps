import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getClient } from '../services/HiveClient';
import {
  hasPendingRewards,
  parsePendingRewards,
  type PendingRewards,
} from '../utils/pendingRewards';

const DISMISS_KEY_PREFIX = 'hivesnaps_pending_rewards_dismissed_';
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Unclaimed rewards for the home-feed banner. Re-checks whenever the screen
 * regains focus (e.g. coming back from claiming on the profile) or the app
 * returns to the foreground, and every 5 minutes while focused. A dismiss is
 * remembered per account until the claimable amounts change.
 */
export function usePendingRewards(username: string | null | undefined) {
  const [rewards, setRewards] = useState<PendingRewards | null>(null);
  const [dismissedSig, setDismissedSig] = useState<string | null>(null);
  const [dismissLoaded, setDismissLoaded] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!username) {
      setRewards(null);
      return;
    }
    const id = ++requestId.current;
    try {
      const [account] = await getClient().database.getAccounts([username]);
      if (id === requestId.current) setRewards(parsePendingRewards(account as any));
    } catch (err) {
      // Non-critical: keep whatever we showed last and try again next tick.
      console.warn('[usePendingRewards] Failed to load account:', err);
    }
  }, [username]);

  useEffect(() => {
    // Never show (or claim) the previous account's rewards; also drop any
    // request still in flight for it.
    requestId.current++;
    setRewards(null);
    setDismissLoaded(false);
    setDismissedSig(null);
    if (!username) return;
    let cancelled = false;
    AsyncStorage.getItem(DISMISS_KEY_PREFIX + username)
      .then(val => { if (!cancelled) setDismissedSig(val); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDismissLoaded(true); });
    return () => { cancelled = true; };
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const interval = setInterval(refresh, REFRESH_MS);
      const sub = AppState.addEventListener('change', state => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
    }, [refresh])
  );

  const dismiss = useCallback(() => {
    if (!username || !rewards) return;
    setDismissedSig(rewards.signature);
    AsyncStorage.setItem(DISMISS_KEY_PREFIX + username, rewards.signature).catch(err =>
      console.warn('[usePendingRewards] Failed to save dismiss:', err)
    );
  }, [username, rewards]);

  const visible =
    !!rewards && dismissLoaded && hasPendingRewards(rewards) && rewards.signature !== dismissedSig;

  return { rewards, visible, dismiss, refresh };
}
