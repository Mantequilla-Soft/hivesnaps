import { useState, useCallback } from 'react';
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

  const join = useCallback(async (name: string): Promise<JoinRoomResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.joinRoom(name);
      setLivekitToken(result.token);
      setRoomName(result.roomName);
      setIsHost(result.isHost);
      // Best-effort metadata — don't fail the join if this 404s
      client.getRoom(name).then(setRoomMeta).catch(() => {});
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
    setLivekitToken(null);
    setRoomName(null);
    setRoomMeta(null);
    setIsHost(false);
    setError(null);
  }, []);

  return { livekitToken, roomName, roomMeta, isHost, isLoading, error, join, create, leave };
}
