import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { getClient } from '../services/HiveClient';

const client = getClient();

const ACTIVE_POLL_MS = 4_000;
const BACKGROUND_POLL_MS = 15_000;
// A reply we just posted shouldn't beep or badge.
const OWN_REPLY_SUPPRESS_MS = 8_000;
const NEAR_TOP_PX = 160;
const SOUND_KEY = 'hivesnaps_snapcast_sound';

async function playChime() {
  try {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/snapcast-chime.wav'), { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate(s => { if (s.isLoaded && s.didJustFinish) sound.unloadAsync(); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* sound is best-effort */ }
}

interface UseSnapCastProps {
  author?: string;
  permlink?: string;
  enabled: boolean;
  /** Silent refetch of the thread (useConversationData.checkForNewContent). */
  refresh: () => Promise<unknown>;
}

/**
 * Client-only "live" mode for a snap thread: polls the root's descendant count
 * (`children`, one cheap RPC) and refetches the replies when it grows. Counts
 * new replies for a "N new snaps" pill only while the reader is scrolled away
 * from the top, so reading is never interrupted.
 */
export function useSnapCast({ author, permlink, enabled, refresh }: UseSnapCastProps) {
  const [newCount, setNewCount] = useState(0);
  const [sound, setSound] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const lastChildrenRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);
  const soundRef = useRef(sound);
  const refreshRef = useRef(refresh);
  soundRef.current = sound;
  refreshRef.current = refresh;

  useEffect(() => {
    AsyncStorage.getItem(SOUND_KEY).then(v => setSound(v === '1')).catch(() => { });
  }, []);

  const toggleSound = useCallback(() => {
    setSound(prev => {
      AsyncStorage.setItem(SOUND_KEY, prev ? '0' : '1').catch(() => { });
      return !prev;
    });
  }, []);

  const markOwnReply = useCallback(() => {
    suppressUntilRef.current = Date.now() + OWN_REPLY_SUPPRESS_MS;
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setNewCount(0);
  }, []);

  // Scrolling back to the top counts as having seen the new snaps.
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
    if (offsetRef.current < NEAR_TOP_PX) setNewCount(0);
  }, []);

  useEffect(() => {
    lastChildrenRef.current = null;
    setNewCount(0);
    if (!enabled || !author || !permlink) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const root = await client.database.call('get_content', [author, permlink]);
        if (cancelled) return;
        const children: number = root?.children ?? 0;
        const prev = lastChildrenRef.current;
        lastChildrenRef.current = children;
        if (prev !== null && children > prev) {
          await refreshRef.current();
          if (cancelled) return;
          if (Date.now() >= suppressUntilRef.current) {
            if (offsetRef.current >= NEAR_TOP_PX) setNewCount(c => c + (children - prev));
            if (soundRef.current) playChime();
          }
        }
      } catch {
        // transient RPC failure — try again next tick
      }
      if (!cancelled) {
        timer = setTimeout(poll, AppState.currentState === 'background' ? BACKGROUND_POLL_MS : ACTIVE_POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, author, permlink]);

  return { newCount, sound, toggleSound, scrollRef, onScroll, scrollToTop, markOwnReply };
}
