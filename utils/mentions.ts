/**
 * @mention helpers for the composer (autocomplete + checking finished
 * mentions), matching snapie.io's lib/chat/mentions.ts.
 */

/**
 * A complete @mention: "@" at the start or after a character that can't be
 * part of a word or address, so "me@gmail.com" is not a mention of gmail.com.
 * The name is capture group 1.
 */
const MENTION_REGEX = /(?:^|[^a-z0-9_.@-])@([a-z0-9.-]+)/gi;

/** A mention still being typed right before the cursor ("…hi @ali|"). */
const MENTION_INPUT_REGEX = /(?:^|\s)@([a-z0-9.-]{0,32})$/i;

/** "@Alice." → "alice": trailing dots/dashes are punctuation, never part of a name. */
export function normalizeMentionToken(value: string): string {
    return value.replace(/^@/, '').trim().toLowerCase().replace(/[.-]+$/, '');
}

/** Distinct mentioned usernames, normalized, in order of appearance. */
export function extractMentions(text: string): string[] {
    const out = new Set<string>();
    for (const match of text.matchAll(MENTION_REGEX)) {
        const name = normalizeMentionToken(match[1]);
        if (name) out.add(name);
    }
    return Array.from(out);
}

export interface MentionDraft {
    /** Index of the "@". */
    start: number;
    /** Cursor position, where the replacement ends. */
    end: number;
    /** What's typed after the "@", lowercased. */
    query: string;
}

/**
 * The "@partial" the cursor is in, if any. Only text before the cursor is
 * considered, so other mentions in the text are never mistaken for it.
 */
export function getMentionDraft(text: string, cursor: number): MentionDraft | null {
    if (!text || cursor < 0 || cursor > text.length) return null;
    const before = text.slice(0, cursor);
    const match = before.match(MENTION_INPUT_REGEX);
    if (!match) return null;
    const start = before.lastIndexOf('@');
    return start < 0 ? null : { start, end: cursor, query: (match[1] ?? '').toLowerCase() };
}

/** Replace the draft with "@name " and give the cursor position after it. */
export function insertMention(text: string, draft: MentionDraft, name: string): { text: string; cursor: number } {
    const before = text.slice(0, draft.start);
    const inserted = `@${name} `;
    // Don't double up a space the text already has after the draft.
    const after = text.slice(draft.end).replace(/^ /, '');
    return { text: before + inserted + after, cursor: before.length + inserted.length };
}
