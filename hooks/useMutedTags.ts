import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTag } from '../utils/mutedTags';

const MUTED_TAGS_KEY = 'hivesnaps_muted_tags';

// Local-only preference (Hive has no native "muted tag"). Module-level so every
// hook instance — e.g. the feed and the profile editor — stays in sync.
let current: string[] = [];
let loaded = false;
const listeners = new Set<(tags: string[]) => void>();

function publish(next: string[]) {
  current = next;
  listeners.forEach(l => l(next));
  AsyncStorage.setItem(MUTED_TAGS_KEY, JSON.stringify(next)).catch(err =>
    console.error('Error saving muted tags:', err)
  );
}

export function useMutedTags() {
  const [mutedTags, setMutedTags] = useState<string[]>(current);

  useEffect(() => {
    listeners.add(setMutedTags);
    if (!loaded) {
      AsyncStorage.getItem(MUTED_TAGS_KEY)
        .then(val => {
          const parsed = val ? JSON.parse(val) : [];
          if (!loaded) current = Array.isArray(parsed) ? parsed : [];
        })
        .catch(() => { })
        .finally(() => {
          loaded = true;
          listeners.forEach(l => l(current));
        });
    }
    return () => { listeners.delete(setMutedTags); };
  }, []);

  const addTag = useCallback((raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !current.includes(tag)) publish([...current, tag]);
  }, []);

  const removeTag = useCallback((tag: string) => {
    publish(current.filter(t => t !== tag));
  }, []);

  return { mutedTags, addTag, removeTag };
}
