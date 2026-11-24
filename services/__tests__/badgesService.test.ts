import { badgePageUrl, clearBadgeCache, fetchAccountBadges } from '../badgesService';

const badge = { account: 'badge-500503', name: 'Bumble Bee (HP)', about: 'Staked HP', image: 'https://files.peakd.com/b.webp' };

function mockFetch(body: unknown, ok = true): void {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });
}

beforeEach(() => {
    clearBadgeCache();
    global.fetch = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('reads the user\'s badges from snapie.io and keeps well-formed ones', async () => {
    mockFetch({ badges: [badge, { account: 'not-a-badge', name: 'x', about: '', image: 'y' }, { ...badge, account: 'badge-1', image: '' }, null] });
    await expect(fetchAccountBadges('Meno')).resolves.toEqual([badge]);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://snapie.io/api/badges/meno');
});

it('caches per user', async () => {
    mockFetch({ badges: [badge] });
    await fetchAccountBadges('meno');
    await fetchAccountBadges('MENO');
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('returns nothing on failure, and retries next time', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(fetchAccountBadges('meno')).resolves.toEqual([]);
    mockFetch({}, false);
    await expect(fetchAccountBadges('meno')).resolves.toEqual([]);
    mockFetch({ badges: [badge] });
    await expect(fetchAccountBadges('meno')).resolves.toEqual([badge]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
});

it('links to the badge on PeakD', () => {
    expect(badgePageUrl('badge-500503')).toBe('https://peakd.com/b/badge-500503');
});
