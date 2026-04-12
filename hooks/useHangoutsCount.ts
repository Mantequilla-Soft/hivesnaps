import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

const POLL_INTERVAL = 30_000;

/**
 * Lightweight hook for the feed header badge.
 * Returns the number of currently active hangout rooms.
 * Polling only runs while the screen is focused — stops on blur to save battery.
 * Fails silently — a missing count is not critical.
 */
export function useHangoutsCount(): number {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;

      const fetch = () => {
        hangoutsAuthService.getClient().listRooms()
          .then((rooms) => { if (mountedRef.current) setCount(rooms.length); })
          .catch(() => {});
      };

      fetch();
      const interval = setInterval(fetch, POLL_INTERVAL);

      return () => {
        mountedRef.current = false;
        clearInterval(interval);
      };
    }, [])
  );

  return count;
}
