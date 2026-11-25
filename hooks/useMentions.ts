import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractMentions, getMentionDraft, insertMention, normalizeMentionToken, type MentionDraft } from '../utils/mentions';
import {
    getKnownValidity,
    MIN_MENTION_QUERY,
    searchUsernamesByPrefix,
    validateUsernames,
} from '../services/usernameLookup';

const SUGGEST_DEBOUNCE_MS = 300;
const VALIDATE_DEBOUNCE_MS = 500;
const MAX_SUGGESTIONS = 6;

export interface UseMentionsResult {
    /** Usernames matching the @mention being typed; empty when there's none. */
    suggestions: string[];
    /** Finished mentions confirmed not to be Hive accounts. */
    unknownMentions: string[];
    /** Insert `@name ` for the mention being typed; null if there isn't one. */
    pick: (name: string) => { text: string; cursor: number } | null;
}

/**
 * @mention autocomplete and checking for a text box, given its text and
 * cursor position (like snapie.io's useMentionAutocomplete +
 * useMentionValidation). Lookups wait for a pause in typing, are cached,
 * and a late answer for an older prefix is ignored.
 */
export function useMentions(text: string, cursor: number): UseMentionsResult {
    const draft: MentionDraft | null = useMemo(() => getMentionDraft(text, cursor), [text, cursor]);
    const query = draft?.query ?? '';
    const [suggestions, setSuggestions] = useState<{ query: string; names: string[] }>({ query: '', names: [] });
    const requestRef = useRef(0);

    useEffect(() => {
        const request = ++requestRef.current;
        if (query.length < MIN_MENTION_QUERY) {
            setSuggestions({ query: '', names: [] });
            return;
        }
        const timer = setTimeout(async () => {
            const names = await searchUsernamesByPrefix(query, MAX_SUGGESTIONS);
            if (request === requestRef.current) setSuggestions({ query, names });
        }, SUGGEST_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    // Mentions to check: finished ones only (not the one still being typed).
    const finished = useMemo(() => {
        const all = extractMentions(text);
        // Compare like extractMentions does ("@smooth." while typing "smooth.witness" is "smooth").
        const typing = draft ? normalizeMentionToken(draft.query) : null;
        return typing ? all.filter((n) => n !== typing) : all;
    }, [text, draft]);
    const finishedKey = finished.join(',');
    const [checked, setChecked] = useState(0);

    useEffect(() => {
        if (finished.length === 0) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            await validateUsernames(finished);
            if (!cancelled) setChecked((n) => n + 1);
        }, VALIDATE_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // finishedKey stands in for `finished` (a new array each render).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finishedKey]);

    const unknownMentions = useMemo(
        () => finished.filter((n) => getKnownValidity(n) === false),
        // `checked` bumps when a lookup finishes, so known validity is re-read.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [finishedKey, checked]
    );

    const pick = useCallback(
        (name: string) => (draft ? insertMention(text, draft, name) : null),
        [text, draft]
    );

    return {
        suggestions: suggestions.query === query ? suggestions.names : [],
        unknownMentions,
        pick,
    };
}
