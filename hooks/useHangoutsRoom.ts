import { useState, useCallback } from 'react';
import type { Room } from '@snapie/hangouts-core';
import { hangoutsAuthService } from '../services/HangoutsAuthService';

export function useHangoutsRoom() {
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomMeta, setRoomMeta] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = hangoutsAuthService.getClient();

  const join = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [result, meta] = await Promise.all([
        client.joinRoom(name),
        client.getRoom(name),
      ]);
      setLivekitToken(result.token);
      setRoomName(result.roomName);
      setRoomMeta(meta);
      setIsHost(result.isHost);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const create = useCallback(async (title: string, description?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { room, token } = await client.createRoom(title, description);
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
