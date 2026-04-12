import { useState, useEffect, useRef } from 'react';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

const POLL_INTERVAL = 30_000; // less aggressive than the lobby's 10s

/**
 * Lightweight hook for the feed header badge.
 * Returns the number of currently active hangout rooms.
 * Polls every 30 seconds and fails silently — a missing count is not critical.
 */
export function useHangoutsCount(): number {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetch = () => {
      hangoutsAuthService.getClient().listRooms()
        .then((rooms) => { if (mountedRef.current) setCount(rooms.length); })
        .catch(() => {}); // non-critical — badge just stays at 0
    };

    fetch();
    const interval = setInterval(fetch, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}
