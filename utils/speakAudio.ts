/**
 * 3Speak audio link shapes, as snapie.io supports them (PRs #345 / #358):
 * - player links: audio.3speak.tv/play?a=<id> (also ?cid=) and ?list=<playlist>,
 *   with the parameters in any order
 * - share links:  3speak.tv/audio?play=<id or owner/id>, 3speak.tv/playlist/<id>
 * Share links are turned into player links so one embed handles them all.
 */

/**
 * Any 3Speak audio or playlist link (global, for match/replace in text).
 * Trailing sentence punctuation ("…/playlist/abc," or "…play=abc.") isn't
 * part of the link.
 */
export const SPEAK_AUDIO_URL_PATTERN =
    /https?:\/\/(?:audio\.3speak\.tv\/play\?|(?:www\.)?3speak\.tv\/(?:audio\/?\?play=|playlist\/))[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi;

const PLAYER = 'https://audio.3speak.tv/play';

/**
 * The audio.3speak.tv player URL for any supported link, or null if it isn't
 * one. A share link's `owner/id` becomes `id`, which is what 3Speak's audio
 * API and player look tracks up by.
 */
export function toSpeakAudioPlayerUrl(link: string): string | null {
    let u: URL;
    try {
        u = new URL(link.replace(/&amp;/gi, '&').replace(/^http:/i, 'https:'));
    } catch {
        return null;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'audio.3speak.tv' && u.pathname.replace(/\/$/, '') === '/play') {
        const list = u.searchParams.get('list');
        if (list) return `${PLAYER}?list=${encodeURIComponent(list)}`;
        const cid = u.searchParams.get('cid');
        const a = u.searchParams.get('a');
        if (a) return `${PLAYER}?a=${encodeURIComponent(a)}`;
        if (cid) return `${PLAYER}?cid=${encodeURIComponent(cid)}`;
        return null;
    }
    if (host === '3speak.tv') {
        const path = u.pathname.replace(/\/$/, '');
        if (path === '/audio') {
            const play = u.searchParams.get('play');
            const id = play?.split('/').filter(Boolean).pop();
            return id ? `${PLAYER}?a=${encodeURIComponent(id)}` : null;
        }
        const playlist = path.match(/^\/playlist\/([^/]+)$/);
        if (playlist) return `${PLAYER}?list=${encodeURIComponent(safeDecode(playlist[1]))}`;
    }
    return null;
}

/** decodeURIComponent that keeps the text as-is when it has a malformed escape ("100%"). */
function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * Remove the 3Speak audio links that will be shown as a player (the ones
 * toSpeakAudioPlayerUrl understands); anything else that merely looks like
 * one stays in the text as a plain link. No regex state is kept between
 * calls, unlike .test() on the global pattern.
 */
export function stripSpeakAudioLinks(text: string): string {
    return text.replace(SPEAK_AUDIO_URL_PATTERN, (link) => (toSpeakAudioPlayerUrl(link) ? '' : link));
}

/** The player URL of the first convertible 3Speak audio link in the text, else null. */
export function findSpeakAudioPlayerUrl(text: string): string | null {
    for (const link of text.match(SPEAK_AUDIO_URL_PATTERN) ?? []) {
        const url = toSpeakAudioPlayerUrl(link);
        if (url) return url;
    }
    return null;
}

/** The playlist id of an audio.3speak.tv `play?list=` URL, else null. */
export function speakPlaylistId(playerUrl: string): string | null {
    try {
        const u = new URL(playerUrl);
        return u.hostname === 'audio.3speak.tv' ? u.searchParams.get('list') : null;
    } catch {
        return null;
    }
}

/** 3Speak's page for a playlist, for when the in-app player has nothing to play. */
export const speakPlaylistPageUrl = (listId: string): string => `https://3speak.tv/playlist/${encodeURIComponent(listId)}`;
