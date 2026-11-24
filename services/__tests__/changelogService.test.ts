jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.4.0' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '9.9.9' } } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG_URL, getAppVersion, getLastSeenVersion, loadChangelog, setLastSeenVersion } from '../changelogService';
import bundled from '../../changelog/changelog.json';
import { parseChangelog } from '../../utils/changelog';

const remote = { entries: [{ version: '1.4.0', date: '2026-11-25', items: [{ type: 'fix', text: 'Corrected note' }] }] };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = jest.fn();
});

it('reports the native app version', () => {
    expect(getAppVersion()).toBe('1.4.0');
});

it('prefers the changelog on main', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(remote) });
    const entries = await loadChangelog();
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(CHANGELOG_URL);
    expect(entries[0].items[0].text).toBe('Corrected note');
});

it('falls back to the bundled copy when offline, on HTTP errors, or for an empty remote', async () => {
    const fallback = parseChangelog(bundled);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(loadChangelog()).resolves.toEqual(fallback);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(loadChangelog()).resolves.toEqual(fallback);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ entries: [] }) });
    await expect(loadChangelog()).resolves.toEqual(fallback);
});

it('stores the last seen version, and reads null when storage fails', async () => {
    await setLastSeenVersion('1.4.0');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('whatsNew.lastSeenVersion', '1.4.0');
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('broken'));
    await expect(getLastSeenVersion()).resolves.toBeNull();
});
