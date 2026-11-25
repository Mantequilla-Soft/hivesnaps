import {
    getCachedMoodBadge,
    getMoodBadge,
    isMoodBadgeSku,
    moodBadgeImageUrl,
    moodSpoken,
    resetMoodBadgeCacheForTests,
} from '../moodBadgeService';

const reply = (body: unknown, ok = true): void => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok, status: ok ? 200 : 500, json: async () => body });
};

beforeEach(() => {
    resetMoodBadgeCacheForTests();
    global.fetch = jest.fn();
});

it("looks up an account's equipped badge from snapie.io's map, fetched once", async () => {
    reply({ meno: 'sleepy', jongolson: 'excited' });
    await expect(getMoodBadge('meno')).resolves.toBe('sleepy');
    await expect(getMoodBadge('Jongolson')).resolves.toBe('excited');
    await expect(getMoodBadge('nobody')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://snapie.io/api/mood-badges/equipped');
    expect(getCachedMoodBadge('meno')).toBe('sleepy');
});

it('skips moods this app version does not know, instead of showing a broken image', async () => {
    reply({ meno: 'sleepy', alice: 'ecstatic', bob: 42 });
    await expect(getMoodBadge('alice')).resolves.toBeNull();
    await expect(getMoodBadge('bob')).resolves.toBeNull();
    await expect(getMoodBadge('meno')).resolves.toBe('sleepy');
});

it('shows no badges when snapie.io is down, without throwing', async () => {
    reply({}, false);
    await expect(getMoodBadge('meno')).resolves.toBeNull();
});

it('shares one request between avatars asking at the same time', async () => {
    reply({ meno: 'sleepy' });
    await Promise.all([getMoodBadge('meno'), getMoodBadge('meno'), getMoodBadge('x')]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('loads the image resized through the Ecency proxy, and reads the mood for screen readers', () => {
    expect(moodBadgeImageUrl('sleepy')).toBe('https://images.ecency.com/64x64/https://snapie.io/badges/sleepy.png');
    expect(moodSpoken('bull')).toBe('feeling bullish');
    expect(isMoodBadgeSku('bear')).toBe(true);
    expect(isMoodBadgeSku('toString')).toBe(false);
});

describe('refreshing', () => {
    let now = 1_000_000;
    beforeEach(() => { now = 1_000_000; jest.spyOn(Date, 'now').mockImplementation(() => now); });
    afterEach(() => jest.restoreAllMocks());

    it('fetches again after 5 minutes, not before', async () => {
        reply({ meno: 'sleepy' });
        await getMoodBadge('meno');
        now += 4 * 60_000;
        await getMoodBadge('meno');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        reply({ meno: 'excited' });
        now += 2 * 60_000;
        await expect(getMoodBadge('meno')).resolves.toBe('excited');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('keeps the last good map when a refresh fails, and waits before retrying', async () => {
        reply({ meno: 'sleepy' });
        await getMoodBadge('meno');
        now += 6 * 60_000;
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
        await expect(getMoodBadge('meno')).resolves.toBe('sleepy');
        now += 60_000;
        await expect(getMoodBadge('meno')).resolves.toBe('sleepy');
        expect(global.fetch).toHaveBeenCalledTimes(2); // no retry inside the back-off
    });
});
