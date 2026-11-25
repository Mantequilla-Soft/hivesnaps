import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import bundledChangelog from '../changelog/changelog.json';
import { parseChangelog, type ChangelogEntry } from '../utils/changelog';

/** The changelog on `main`: edits there reach installed apps without a store release. */
export const CHANGELOG_URL = 'https://raw.githubusercontent.com/Mantequilla-Soft/hivesnaps/main/changelog/changelog.json';
const FETCH_TIMEOUT_MS = 8_000;
const LAST_SEEN_KEY = 'whatsNew.lastSeenVersion';
const SHOW_ON_UPDATE_KEY = 'whatsNew.showOnUpdate';

/** The installed app's version, e.g. "1.4.0". */
export function getAppVersion(): string {
    return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

/** The latest changelog from GitHub, or the copy bundled with this build if that fails. */
export async function loadChangelog(): Promise<ChangelogEntry[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(CHANGELOG_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`Changelog fetch failed: ${res.status}`);
        const remote = parseChangelog(await res.json());
        if (remote.length > 0) return remote;
    } catch (err) {
        console.warn('[changelog] using the bundled copy:', err);
    } finally {
        clearTimeout(timer);
    }
    return parseChangelog(bundledChangelog);
}

/** The last version whose "What's new" was dismissed, or null if none yet. */
export async function getLastSeenVersion(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(LAST_SEEN_KEY);
    } catch {
        return null;
    }
}

export async function setLastSeenVersion(version: string): Promise<void> {
    try {
        await AsyncStorage.setItem(LAST_SEEN_KEY, version);
    } catch (err) {
        console.warn('[changelog] could not save last seen version:', err);
    }
}

/**
 * Whether "What's new" pops up on the feed after an update. Off unless the
 * user turned it on in Profile: the notes are always there, with a "New"
 * label on the Profile row until they're seen.
 */
export async function getShowOnUpdate(): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(SHOW_ON_UPDATE_KEY)) === 'true';
    } catch {
        return false;
    }
}

/** Saves the setting; resolves false if it couldn't be saved. */
export async function setShowOnUpdate(show: boolean): Promise<boolean> {
    try {
        await AsyncStorage.setItem(SHOW_ON_UPDATE_KEY, show ? 'true' : 'false');
        return true;
    } catch (err) {
        console.warn('[changelog] could not save the What\'s new setting:', err);
        return false;
    }
}

