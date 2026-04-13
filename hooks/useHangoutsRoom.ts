import { useState, useCallback, useRef } from 'react';
import type { Room, JoinRoomResponse, CreateRoomResponse } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

interface UseHangoutsRoomResult {
  livekitToken: string | null;
  roomName: string | null;
  roomMeta: Room | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  join: (name: string) => Promise<JoinRoomResponse>;
  create: (title: string, description?: string) => Promise<CreateRoomResponse>;
  leave: () => void;
}

export function useHangoutsRoom(): UseHangoutsRoomResult {
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomMeta, setRoomMeta] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = hangoutsAuthService.getClient();

  // Incremented on every join/create/leave so any in-flight async completion
  // from a previous operation cannot write state after the room has changed.
  const activeOpRef = useRef(0);
  // Tracks the normalized room name of the latest join for the best-effort
  // getRoom metadata lookup.
  const latestJoinRef = useRef<string | null>(null);

  const join = useCallback(async (name: string): Promise<JoinRoomResponse> => {
    const op = ++activeOpRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.joinRoom(name);
      if (activeOpRef.current !== op) return result; // superseded by leave/create
      const joinedName = result.roomName;
      latestJoinRef.current = joinedName;
      setLivekitToken(result.token);
      setRoomName(joinedName);
      setIsHost(result.isHost);
      setRoomMeta(null); // clear stale metadata before lookup
      // Best-effort metadata — only commits if this op is still the latest.
      client.getRoom(joinedName)
        .then((meta) => {
          if (latestJoinRef.current === joinedName) setRoomMeta(meta);
        })
        .catch(() => {
          if (latestJoinRef.current === joinedName) setRoomMeta(null);
        });
      return result;
    } catch (err) {
      if (activeOpRef.current === op) {
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
      throw err;
    } finally {
      if (activeOpRef.current === op) setIsLoading(false);
    }
  }, [client]);

  const create = useCallback(async (title: string, description?: string): Promise<CreateRoomResponse> => {
    const op = ++activeOpRef.current;
    latestJoinRef.current = null; // invalidate any in-flight join metadata lookup
    setIsLoading(true);
    setError(null);
    try {
      const response: CreateRoomResponse = await client.createRoom(title, description);
      const { room, token } = response;
      if (activeOpRef.current !== op) return response; // superseded by leave
      setLivekitToken(token);
      setRoomName(room.name);
      setRoomMeta(room);
      setIsHost(true);
      return response;
    } catch (err) {
      if (activeOpRef.current === op) {
        setError(err instanceof Error ? err.message : 'Failed to create room');
      }
      throw err;
    } finally {
      if (activeOpRef.current === op) setIsLoading(false);
    }
  }, [client]);

  const leave = useCallback(() => {
    activeOpRef.current++; // invalidate any in-flight join/create completion
    latestJoinRef.current = null;
    setIsLoading(false); // clear loading if an op was in flight
    setLivekitToken(null);
    setRoomName(null);
    setRoomMeta(null);
    setIsHost(false);
    setError(null);
  }, []);

  return { livekitToken, roomName, roomMeta, isHost, isLoading, error, join, create, leave };
}
