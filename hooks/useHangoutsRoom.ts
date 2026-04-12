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
  create: (title: string, description?: string) => Promise<Room>;
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
  // Tracks the most recently joined room name so stale getRoom responses can't
  // overwrite metadata if a second join happens before the first resolves.
  const latestJoinRef = useRef<string | null>(null);

  const join = useCallback(async (name: string): Promise<JoinRoomResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.joinRoom(name);
      const joinedName = result.roomName;
      latestJoinRef.current = joinedName;
      setLivekitToken(result.token);
      setRoomName(joinedName);
      setIsHost(result.isHost);
      setRoomMeta(null); // clear stale metadata before the lookup resolves
      // Best-effort metadata using the server-normalized room name.
      // Only commits if no newer join/create/leave has invalidated the ref.
      client.getRoom(joinedName)
        .then((meta) => {
          if (latestJoinRef.current === joinedName) setRoomMeta(meta);
        })
        .catch(() => {
          if (latestJoinRef.current === joinedName) setRoomMeta(null);
        });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const create = useCallback(async (title: string, description?: string): Promise<Room> => {
    setIsLoading(true);
    setError(null);
    latestJoinRef.current = null; // invalidate any in-flight join metadata lookup
    try {
      const { room, token }: CreateRoomResponse = await client.createRoom(title, description);
      setLivekitToken(token);
      setRoomName(room.name);
      setRoomMeta(room);
      setIsHost(true);
      return room;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const leave = useCallback(() => {
    latestJoinRef.current = null; // invalidate any in-flight metadata lookup
    setLivekitToken(null);
    setRoomName(null);
    setRoomMeta(null);
    setIsHost(false);
    setError(null);
  }, []);

  return { livekitToken, roomName, roomMeta, isHost, isLoading, error, join, create, leave };
}
