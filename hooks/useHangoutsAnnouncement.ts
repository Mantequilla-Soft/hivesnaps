import { useState, useCallback, useEffect, useRef } from 'react';
import { PrivateKey } from '@hiveio/dhive';
import { getClient } from '../services/HiveClient';
import { accountStorageService } from '../services/AccountStorageService';
import { postSnapWithBeneficiaries } from '../services/snapPostingService';

export function useHangoutsAnnouncement() {
  const [isPosting, setIsPosting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const announce = useCallback(async (
    roomName: string,
    roomTitle: string,
    description?: string,
  ): Promise<void> => {
    try {
      const username = await accountStorageService.getCurrentAccountUsername();
      const postingKeyStr = await accountStorageService.getCurrentPostingKey();
      if (!username || !postingKeyStr) return;

      const client = getClient();
      const discussions = await client.database.call('get_discussions_by_blog', [
        { tag: 'peak.snaps', limit: 1 },
      ]);
      if (!discussions || discussions.length === 0) return;
      const container = discussions[0];

      const roomUrl = `https://hangout.3speak.tv/room/${roomName}`;
      const body = description ? `${description}\n\n${roomUrl}` : roomUrl;

      const permlink = `snap-${Date.now()}`;
      const json_metadata = JSON.stringify({
        app: 'hivesnaps/1.0',
        tags: ['hive-178315', 'snaps', 'hangouts'],
      });

      if (isMountedRef.current) setIsPosting(true);
      try {
        const postingKey = PrivateKey.fromString(postingKeyStr);
        await postSnapWithBeneficiaries(
          client,
          {
            parentAuthor: container.author,
            parentPermlink: container.permlink,
            author: username,
            permlink,
            title: roomTitle,
            body,
            jsonMetadata: json_metadata,
            hasVideo: false,
            hasAudio: false,
            hasHangout: true,
          },
          postingKey,
        );
      } finally {
        if (isMountedRef.current) setIsPosting(false);
      }
    } catch (err) {
      console.warn('[useHangoutsAnnouncement] Failed to post snap:', err instanceof Error ? err.message : err);
    }
  }, []);

  return { announce, isPosting };
}
