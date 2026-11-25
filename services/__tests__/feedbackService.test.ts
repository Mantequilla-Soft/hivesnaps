jest.mock('../pointsAuthService', () => ({ getPointsAuthToken: jest.fn() }));
jest.mock('../changelogService', () => ({ getAppVersion: () => '1.4.0' }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18.2' } }));

import {
    appVersionLabel,
    feedbackError,
    fetchFeedbackIdentity,
    getFeedbackToken,
    FEEDBACK_TOKEN_TIMEOUT_MS,
    screenshotProblem,
    submitFeedback,
    FEEDBACK_MESSAGE_MAX,
} from '../feedbackService';
import { getPointsAuthToken } from '../pointsAuthService';

function reply(body: unknown, ok = true, status = 200): void {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
});

it('labels the app version and platform', () => {
    expect(appVersionLabel()).toBe('1.4.0 (ios 18.2)');
});

it('validates the note', () => {
    expect(feedbackError('', 'x')).toMatch(/title and a message/);
    expect(feedbackError('t', '  ')).toMatch(/title and a message/);
    expect(feedbackError('x'.repeat(121), 'b')).toMatch(/title is too long/);
    expect(feedbackError('t', 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1))).toMatch(/message is too long/);
    expect(feedbackError('t', 'x'.repeat(FEEDBACK_MESSAGE_MAX))).toBeNull();
});

it('checks screenshot type and size', () => {
    expect(screenshotProblem({ mimeType: 'image/png', fileSize: 1000 })).toBeNull();
    expect(screenshotProblem({ mimeType: 'image/heic', fileSize: 1000 })).toBeNull();
    expect(screenshotProblem({ mimeType: 'image/gif', fileSize: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(screenshotProblem({ fileSize: 5 * 1024 * 1024 })).toBeNull();
    expect(screenshotProblem({ fileSize: 6 * 1024 * 1024 })).toMatch(/over 5 MB/);
    // A size we can't read isn't let through unchecked.
    expect(screenshotProblem({ mimeType: 'image/png' })).toMatch(/couldn’t read that image’s size/);
});

describe('submitFeedback', () => {
    it('posts to snapie.io with the token, the hivesnaps source and the app version', async () => {
        reply({ url: 'https://github.com/Mantequilla-Soft/hivesnaps/issues/1' }, true, 201);
        const result = await submitFeedback(
            { title: ' Crash ', body: ' It broke ', category: 'bug', screenshotUrl: 'https://images.hive.blog/x.png' },
            'JWT'
        );
        expect(result).toEqual({ ok: true, issueUrl: 'https://github.com/Mantequilla-Soft/hivesnaps/issues/1' });
        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('https://snapie.io/api/feedback');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer JWT');
        expect(JSON.parse(init.body)).toEqual({
            title: 'Crash',
            body: 'It broke',
            category: 'bug',
            source: 'hivesnaps',
            appVersion: '1.4.0 (ios 18.2)',
            screenshotUrl: 'https://images.hive.blog/x.png',
        });
    });

    it('sends as a guest without a token, and leaves out an empty screenshot', async () => {
        reply({ url: null }, true, 201);
        await expect(submitFeedback({ title: 't', body: 'b', category: 'idea' }, null)).resolves.toEqual({ ok: true, issueUrl: null });
        const [, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(init.headers.Authorization).toBeUndefined();
        expect(JSON.parse(init.body).screenshotUrl).toBeUndefined();
    });

    it('shows the server message on errors (e.g. the rate limit), and ignores odd issue links', async () => {
        reply({ error: "You've sent several notes recently. Please try again in a little while." }, false, 429);
        await expect(submitFeedback({ title: 't', body: 'b', category: 'other' }, 'JWT')).resolves.toEqual({
            ok: false,
            error: "You've sent several notes recently. Please try again in a little while.",
        });
        reply({ url: 'https://evil.example/x' }, true, 201);
        await expect(submitFeedback({ title: 't', body: 'b', category: 'other' }, 'JWT')).resolves.toEqual({ ok: true, issueUrl: null });
    });

    it('reports a network failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
        const result = await submitFeedback({ title: 't', body: 'b', category: 'bug' }, null);
        expect(result.ok).toBe(false);
    });
});

it('asks snapie.io who the token belongs to', async () => {
    reply({ hiveUsername: 'meno' });
    await expect(fetchFeedbackIdentity('JWT')).resolves.toBe('meno');
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('Bearer JWT');
    reply({ hiveUsername: null });
    await expect(fetchFeedbackIdentity(null)).resolves.toBeNull();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(fetchFeedbackIdentity('JWT')).resolves.toBeNull();
});

it('uses the Snapie Points token, and sends as a guest if getting it fails', async () => {
    (getPointsAuthToken as jest.Mock).mockResolvedValueOnce('JWT').mockRejectedValueOnce(new Error('no key'));
    await expect(getFeedbackToken()).resolves.toBe('JWT');
    await expect(getFeedbackToken()).resolves.toBeNull();
});

it('stops waiting for sign-in after the timeout and sends as a guest', async () => {
    jest.useFakeTimers();
    try {
        (getPointsAuthToken as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
        const token = getFeedbackToken();
        jest.advanceTimersByTime(FEEDBACK_TOKEN_TIMEOUT_MS);
        await expect(token).resolves.toBeNull();
    } finally {
        jest.useRealTimers();
    }
});
