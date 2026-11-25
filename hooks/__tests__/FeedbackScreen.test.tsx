/**
 * FeedbackScreen: a screenshot is uploaded only after snapie.io confirms the
 * account, so a note it would reject never leaves a public image behind.
 */
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
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
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import FeedbackScreen from '../../app/screens/FeedbackScreen';
import { pickImage, uploadPickedImage } from '../../utils/pickImage';
import { fetchFeedbackIdentity, getFeedbackToken, submitFeedback } from '../../services/feedbackService';

const byLabel = (root: ReactTestInstance, label: string): ReactTestInstance =>
    root.find((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function' || (n.props?.accessibilityLabel === label && n.props?.onChangeText));

async function setup(): Promise<ReactTestRenderer> {
    let r!: ReactTestRenderer;
    await act(async () => { r = create(<FeedbackScreen />); });
    await act(async () => { byLabel(r.root, 'Title').props.onChangeText('Crash'); });
    await act(async () => { byLabel(r.root, 'Message').props.onChangeText('It broke'); });
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file://s.png', mimeType: 'image/png', fileSize: 1000 });
    const attach = r.root.find((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'Attach a screenshot (optional)').length > 0);
    await act(async () => { await attach.props.onPress(); });
    return r;
}

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
