import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

const POLL_INTERVAL = 30_000;

/**
 * Lightweight hook for the feed header badge.
 * Returns the number of currently active hangout rooms.
 * Polling only runs while the screen is focused — stops on blur to save battery.
 * Uses a generation counter so a stale response from a previous focus cycle
 * cannot overwrite a fresh count after refocus. Fails silently.
 */
export function useHangoutsCount(): number {
  const [count, setCount] = useState(0);
  const generationRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const gen = ++generationRef.current;

      const fetch = () => {
        hangoutsAuthService.getClient().listRooms()
          .then((rooms) => { if (generationRef.current === gen) setCount(rooms.length); })
          .catch(() => {});
      };

      fetch();
      const interval = setInterval(fetch, POLL_INTERVAL);

      return () => {
        generationRef.current++; // invalidate in-flight requests from this cycle
        clearInterval(interval);
      };
    }, [])
  );

  return count;
}
