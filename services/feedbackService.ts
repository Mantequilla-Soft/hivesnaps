// In-app feedback, sent through snapie.io's /api/feedback, which opens a
// GitHub issue with a token kept on its server (a token inside the app could
// be pulled out of the APK). `source: 'hivesnaps'` asks snapie.io to file it
// in the hivesnaps repo (snapie-io#376); until that ships the field is ignored
// and notes land in the snapie-io repo.

import { Platform } from 'react-native';
import { getPointsAuthToken } from './pointsAuthService';
import { getAppVersion } from './changelogService';

const FEEDBACK_URL = 'https://snapie.io/api/feedback';
const TIMEOUT_MS = 15_000;

/** snapie.io's limits (lib/feedback/model.ts). */
export const FEEDBACK_TITLE_MAX = 120;
export const FEEDBACK_BODY_MAX = 4_000;
/** What the message box allows. */
export const FEEDBACK_MESSAGE_MAX = FEEDBACK_BODY_MAX;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

export type FeedbackCategory = 'bug' | 'idea' | 'other';

export interface FeedbackInput {
    title: string;
    body: string;
    category: FeedbackCategory;
    screenshotUrl?: string | null;
}

export type FeedbackResult = { ok: true; issueUrl: string | null } | { ok: false; error: string };

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/** "1.4.0 (ios 18.2)": shown on the issue so reports say what they're about. */
export function appVersionLabel(): string {
    return `${getAppVersion()} (${Platform.OS} ${String(Platform.Version)})`;
}

/** Why a picked screenshot can't be attached, or null if it's fine. HEIC is converted to JPEG on upload. */
export function screenshotProblem(image: { fileSize?: number; mimeType?: string }): string | null {
    if (image.mimeType && !SCREENSHOT_TYPES.has(image.mimeType.toLowerCase())) {
        return 'Screenshots can be PNG, JPEG or WebP.';
    }
    if (image.fileSize && image.fileSize > FEEDBACK_SCREENSHOT_MAX_BYTES) {
        return 'That image is over 5 MB. Try a smaller one.';
    }
    return null;
}

/** First problem with the typed note, or null. */
export function feedbackError(title: string, body: string): string | null {
    if (!title.trim() || !body.trim()) return 'Add a short title and a message.';
    if (title.trim().length > FEEDBACK_TITLE_MAX) return 'That title is too long.';
    if (body.trim().length > FEEDBACK_MESSAGE_MAX) return 'That message is too long.';
    return null;
}

function authHeaders(token: string | null): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * The account snapie.io will attribute feedback to with this token (null
 * means it'll arrive as a guest). Checked before uploading a screenshot, since
 * the server rejects screenshots from guests: no orphaned public images.
 */
export async function fetchFeedbackIdentity(token: string | null): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(FEEDBACK_URL, {
            method: 'GET',
            headers: { Accept: 'application/json', ...authHeaders(token) },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { hiveUsername?: unknown };
        return typeof data.hiveUsername === 'string' ? data.hiveUsername : null;
    } catch {
        return null;
    }
}

/** The signed-in user's snapie.io token, or null (feedback then goes as a guest). */
export const getFeedbackToken = (): Promise<string | null> => getPointsAuthToken().catch(() => null);

export async function submitFeedback(input: FeedbackInput, token: string | null): Promise<FeedbackResult> {
    const payload: Record<string, string> = {
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category,
        source: 'hivesnaps',
        // snapie.io shows this on the issue's "From" line.
        appVersion: appVersionLabel(),
    };
    if (input.screenshotUrl) payload.screenshotUrl = input.screenshotUrl;
    try {
        const res = await fetchWithTimeout(FEEDBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(token) },
            body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: unknown; url?: unknown };
        if (!res.ok) {
            const message =
                typeof data.error === 'string' && data.error.length > 0 && data.error.length < 240
                    ? data.error
                    : 'We couldn’t send that. Please try again.';
            return { ok: false, error: message };
        }
        const issueUrl = typeof data.url === 'string' && data.url.startsWith('https://github.com/') ? data.url : null;
        return { ok: true, issueUrl };
    } catch {
        return { ok: false, error: 'We couldn’t send that. Please check your connection and try again.' };
    }
}
