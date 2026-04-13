import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

const POLL_INTERVAL = 10_000;

interface UseHangoutsRoomListResult {
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHangoutsRoomList(): UseHangoutsRoomListResult {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const data = await hangoutsAuthService.getClient().listRooms();
      if (!mountedRef.current) return;
      setRooms(data);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      inflightRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { rooms, isLoading, error, refresh };
}
