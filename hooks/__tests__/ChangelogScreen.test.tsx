/** Opening the notes counts as seeing them, which clears the "New" label on Profile. */
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: unknown }) => children }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => new Proxy({}, { get: () => '#000' }) }));
jest.mock('../../services/changelogService', () => ({
    getAppVersion: () => '1.4.0',
    loadChangelog: jest.fn().mockResolvedValue([]),
    setLastSeenVersion: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import ChangelogScreen from '../../app/screens/ChangelogScreen';
import { setLastSeenVersion } from '../../services/changelogService';

it('marks the installed version as seen when the notes are opened', async () => {
    await act(async () => { create(<ChangelogScreen />); });
    expect(setLastSeenVersion).toHaveBeenCalledWith('1.4.0');
});
