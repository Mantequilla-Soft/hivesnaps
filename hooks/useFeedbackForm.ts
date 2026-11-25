import { useCallback, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { pickImage, uploadPickedImage, type PickedImage } from '../utils/pickImage';
import {
    feedbackError,
    fetchFeedbackIdentity,
    getFeedbackToken,
    screenshotProblem,
    submitFeedback,
    type FeedbackCategory,
} from '../services/feedbackService';

export type FeedbackStage = 'idle' | 'checking' | 'uploading' | 'sending';

export type AttachResult = { ok: true } | { ok: false; problem: string } | { ok: false; problem: null };

/** The picker doesn't always report a size (iOS can't always read it); ask the file system then. */
async function withFileSize(image: PickedImage): Promise<PickedImage> {
    if (image.fileSize) return image;
    try {
        const info = await FileSystem.getInfoAsync(image.uri);
        return info.exists && typeof info.size === 'number' ? { ...image, fileSize: info.size } : image;
    } catch {
        return image;
    }
}

/**
 * The feedback form: what's typed, the optional screenshot, and sending it.
 * A screenshot is uploaded only after snapie.io confirms the account, so a
 * note it would reject never leaves a public image behind.
 */
export function useFeedbackForm(currentUsername: string | null) {
    const [category, setCategory] = useState<FeedbackCategory>('bug');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [screenshot, setScreenshot] = useState<PickedImage | null>(null);
    const [stage, setStage] = useState<FeedbackStage>('idle');
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState<{ issueUrl: string | null } | null>(null);
    // One send at a time, even if Send is tapped twice before a re-render.
    const sendingRef = useRef(false);

    const busy = stage !== 'idle';
    const dirty = !!(title.trim() || body.trim() || screenshot);
    const canSend = !busy && !!title.trim() && !!body.trim();

    /** Pick a screenshot. `problem` is set when it can't be attached; null problem means cancelled. */
    const attach = useCallback(async (): Promise<AttachResult> => {
        let picked: PickedImage | null;
        try {
            picked = await pickImage({ title: 'Attach a screenshot', square: false });
        } catch (err) {
            console.warn('[Feedback] picking a screenshot failed:', err instanceof Error ? err.message : err);
            return { ok: false, problem: 'We couldn’t open that image. Try another one.' };
        }
        if (!picked) return { ok: false, problem: null };
        const image = await withFileSize(picked);
        const problem = screenshotProblem(image);
        if (problem) return { ok: false, problem };
        setScreenshot(image);
        setError(null);
        return { ok: true };
    }, []);

    const removeScreenshot = useCallback(() => setScreenshot(null), []);

    const send = useCallback(async (): Promise<void> => {
        if (sendingRef.current) return;
        const problem = feedbackError(title, body);
        if (problem) {
            setError(problem);
            return;
        }
        sendingRef.current = true;
        setError(null);
        try {
            setStage('checking');
            const token = await getFeedbackToken();
            let screenshotUrl: string | null = null;
            if (screenshot) {
                const who = await fetchFeedbackIdentity(token);
                if (!who || !currentUsername || who !== currentUsername.toLowerCase()) {
                    setError('We couldn’t confirm your account to attach the screenshot. Remove it to send the note without it, or try again.');
                    return;
                }
                setStage('uploading');
                try {
                    screenshotUrl = await uploadPickedImage(screenshot, currentUsername);
                } catch {
                    setError('We couldn’t upload that screenshot. Try again, or remove it to send the note without it.');
                    return;
                }
            }
            setStage('sending');
            const result = await submitFeedback({ title, body, category, screenshotUrl }, token);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setSent({ issueUrl: result.issueUrl });
        } finally {
            sendingRef.current = false;
            setStage('idle');
        }
    }, [title, body, category, screenshot, currentUsername]);

    return {
        category,
        setCategory,
        title,
        setTitle,
        body,
        setBody,
        screenshot,
        removeScreenshot,
        stage,
        error,
        sent,
        busy,
        dirty,
        canSend,
        attach,
        send,
    };
}
