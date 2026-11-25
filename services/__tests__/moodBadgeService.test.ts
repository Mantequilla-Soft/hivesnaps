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
