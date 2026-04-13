import { useState, useCallback, useEffect, useRef } from 'react';
import { PrivateKey } from '@hiveio/dhive';
import { getClient } from '../services/HiveClient';
import { accountStorageService } from '../services/AccountStorageService';
import { hangoutsAuthService } from '../services/HangoutsAuthService';
import { postSnapWithBeneficiaries } from '../services/snapPostingService';

interface UseHangoutsRecordingResult {
  isRecording: boolean;
  isUploading: boolean;
  startRecording: () => Promise<void>;
  stopAndPost: () => Promise<void>;
}

export function useHangoutsRecording(
  roomName: string,
  roomTitle: string,
  roomDescription: string,
): UseHangoutsRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      await hangoutsAuthService.getClient().startRecording(roomName);
      if (isMountedRef.current) setIsRecording(true);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to start recording');
    }
  }, [roomName]);

  const stopAndPost = useCallback(async (): Promise<void> => {
    try {
      // Wait for stop to succeed before flipping UI — if it fails, recording is still active
      const stopResult = await hangoutsAuthService.getClient().stopRecording(roomName);

      if (isMountedRef.current) {
        setIsRecording(false);
        setIsUploading(true);
      }

      const uploadResult = await hangoutsAuthService.getClient().uploadRecording(
        roomName,
        stopResult.filePath,
        stopResult.duration,
        roomTitle,
        ['hive-178315', 'snaps', 'hangouts'],
      );

      // Post the audio snap to Hive with 10% beneficiary to @snapie
      const username = await accountStorageService.getCurrentAccountUsername();
      const postingKeyStr = await accountStorageService.getCurrentPostingKey();
      if (!username || !postingKeyStr) {
        throw new Error('No active Hive account available to post the recording.');
      }

      const hiveClient = getClient();
      const discussions = await hiveClient.database.call('get_discussions_by_blog', [
        { tag: 'peak.snaps', limit: 1 },
      ]);
      if (!discussions || discussions.length === 0) {
        throw new Error('Could not resolve the snap container for the recording post.');
      }
      const container = discussions[0];

      const body = roomDescription
        ? `${roomDescription}\n\n${uploadResult.playUrl}`
        : uploadResult.playUrl;

      const permlink = `snap-${Date.now()}`;
      const json_metadata = JSON.stringify({
        app: 'hivesnaps/1.0',
        tags: ['hive-178315', 'snaps', 'hangouts'],
        audio: {
          platform: '3speak',
          url: uploadResult.playUrl,
        },
      });

      const postingKey = PrivateKey.fromString(postingKeyStr);
      await postSnapWithBeneficiaries(
        hiveClient,
        {
          parentAuthor: container.author,
          parentPermlink: container.permlink,
          author: username,
          permlink,
          title: roomTitle,
          body,
          jsonMetadata: json_metadata,
          hasVideo: false,
          hasAudio: true,
        },
        postingKey,
      );
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to stop and post recording');
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  }, [roomName, roomTitle, roomDescription]);

  return { isRecording, isUploading, startRecording, stopAndPost };
}
