/**
 * FeedbackScreen: a screenshot is uploaded only after snapie.io confirms the
 * account, so a note it would reject never leaves a public image behind.
 */
const mockBack = jest.fn();
const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ back: mockBack, push: jest.fn() }),
    useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: unknown }) => children }));
jest.mock('../../hooks/useTheme', () => ({
    useTheme: () => new Proxy({}, { get: () => '#000' }),
}));
jest.mock('../../store/context', () => ({ useAuth: () => ({ currentUsername: 'meno' }) }));
jest.mock('../../utils/pickImage', () => ({ pickImage: jest.fn(), uploadPickedImage: jest.fn() }));
jest.mock('../../services/feedbackService', () => {
    const actual = jest.requireActual('../../services/feedbackService');
    return {
        ...actual,
        getFeedbackToken: jest.fn(),
        fetchFeedbackIdentity: jest.fn(),
        submitFeedback: jest.fn(),
    };
});
jest.mock('../../services/changelogService', () => ({ getAppVersion: () => '1.4.0' }));
jest.mock('../../services/pointsAuthService', () => ({ getPointsAuthToken: jest.fn() }));

import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { usePreventRemove } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import FeedbackScreen from '../../app/screens/FeedbackScreen';
import { pickImage, uploadPickedImage } from '../../utils/pickImage';
import { fetchFeedbackIdentity, getFeedbackToken, submitFeedback } from '../../services/feedbackService';

const byLabel = (root: ReactTestInstance, label: string): ReactTestInstance =>
    root.find((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function' || (n.props?.accessibilityLabel === label && n.props?.onChangeText));

const attachButton = (r: ReactTestRenderer): ReactTestInstance =>
    r.root.find((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'Attach a screenshot (optional)').length > 0);

async function typeNote(): Promise<ReactTestRenderer> {
    let r!: ReactTestRenderer;
    await act(async () => { r = create(<FeedbackScreen />); });
    await act(async () => { byLabel(r.root, 'Title').props.onChangeText('Crash'); });
    await act(async () => { byLabel(r.root, 'Message').props.onChangeText('It broke'); });
    return r;
}

async function setup(): Promise<ReactTestRenderer> {
    const r = await typeNote();
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file://s.png', mimeType: 'image/png', fileSize: 1000 });
    await act(async () => { await attachButton(r).props.onPress(); });
    return r;
}

const hasScreenshot = (r: ReactTestRenderer): boolean =>
    r.root.findAll((n) => n.props?.accessibilityLabel === 'Remove screenshot').length > 0;

beforeEach(() => {
    jest.clearAllMocks();
    (getFeedbackToken as jest.Mock).mockResolvedValue('JWT');
    (submitFeedback as jest.Mock).mockResolvedValue({ ok: true, issueUrl: null });
    (uploadPickedImage as jest.Mock).mockResolvedValue('https://images.hive.blog/s.png');
});

it('does not upload the screenshot when snapie.io does not confirm the account', async () => {
    (fetchFeedbackIdentity as jest.Mock).mockResolvedValue(null);
    const r = await setup();
    await act(async () => { await byLabel(r.root, 'Send feedback').props.onPress(); });
    expect(uploadPickedImage).not.toHaveBeenCalled();
    expect(submitFeedback).not.toHaveBeenCalled();
});

it('uploads after the account is confirmed and sends the note with it', async () => {
    (fetchFeedbackIdentity as jest.Mock).mockResolvedValue('meno');
    const r = await setup();
    await act(async () => { await byLabel(r.root, 'Send feedback').props.onPress(); });
    expect(uploadPickedImage).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://s.png' }), 'meno');
    expect(submitFeedback).toHaveBeenCalledWith(
        { title: 'Crash', body: 'It broke', category: 'bug', screenshotUrl: 'https://images.hive.blog/s.png' },
        'JWT'
    );
});

it('shows an error, and keeps the note, when the picker fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await typeNote();
    (pickImage as jest.Mock).mockRejectedValue(new Error('Camera not available on simulator'));
    await act(async () => { await attachButton(r).props.onPress(); });
    expect(alert).toHaveBeenCalledWith('Can’t attach that image', expect.stringMatching(/couldn’t open that image/));
    expect(byLabel(r.root, 'Title').props.value).toBe('Crash');
    expect(hasScreenshot(r)).toBe(false);
});

it('reads the file size when the picker leaves it out, and refuses a screenshot over 5 MB', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await typeNote();
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file://big.png', mimeType: 'image/png' });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 6 * 1024 * 1024 });
    await act(async () => { await attachButton(r).props.onPress(); });
    expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('file://big.png');
    expect(alert).toHaveBeenCalledWith('Can’t attach that image', expect.stringMatching(/over 5 MB/));
    expect(hasScreenshot(r)).toBe(false);
});

it('guards leaving only while there is an unsent note, and Discard continues the original navigation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let r!: ReactTestRenderer;
    await act(async () => { r = create(<FeedbackScreen />); });
    const calls = (usePreventRemove as jest.Mock).mock.calls;
    expect(calls[calls.length - 1][0]).toBe(false);

    await act(async () => { byLabel(r.root, 'Title').props.onChangeText('Crash'); });
    const [prevent, onRemove] = calls[calls.length - 1];
    expect(prevent).toBe(true);

    const action = { type: 'GO_BACK' };
    onRemove({ data: { action } });
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Discard')!.onPress!();
    expect(mockDispatch).toHaveBeenCalledWith(action);
});
