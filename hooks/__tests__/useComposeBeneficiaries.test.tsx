/**
 * Blog composer beneficiaries in useCompose: the reducer keeps one entry per
 * account, publish is blocked over 100%, and a published post sends the
 * chosen beneficiaries plus the @snapie share the editor showed, then clears
 * them.
 */

jest.mock('../../services/AccountStorageService', () => ({
    accountStorageService: {
        getCurrentAccountUsername: jest.fn().mockResolvedValue('meno'),
        getCurrentPostingKey: jest.fn().mockResolvedValue('posting-wif'),
    },
}));
jest.mock('@hiveio/dhive', () => ({ PrivateKey: { fromString: jest.fn(() => 'KEY') } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn(() => ({})) }));
jest.mock('../../services/AvatarService', () => ({
    avatarService: { getCachedAvatarUrl: () => null, getAvatarUrl: () => Promise.resolve({ url: null }) },
}));
jest.mock('../../utils/imageUploadService', () => ({ uploadImageSmart: jest.fn() }));
jest.mock('../../services/snapPostingService', () => ({ postSnapWithBeneficiaries: jest.fn() }));
jest.mock('../useBlogFeed', () => ({ SNAPIE_COMMUNITY: 'hive-178315' }));
jest.mock('../../utils/imageConverter', () => ({ convertImageSmart: jest.fn(), convertToJPEG: jest.fn() }));
jest.mock('../../services/audioUploadService', () => ({ uploadAudioTo3Speak: jest.fn() }));
jest.mock('../../services/pointsService', () => ({ awardPoints: jest.fn() }));
jest.mock('../../utils/pointsConfig', () => ({ isPointsEnabled: () => false }));
const mockVideo = {
    videoEmbedUrl: null as string | null,
    thumbnailUrl: null,
    uploadUrl: null,
    uploading: false,
    asset: null,
    assetId: null,
    hasVideo: false,
    clear: jest.fn(),
};
jest.mock('../useVideoUpload', () => ({ useVideoUpload: () => mockVideo }));
const mockReply = { posting: false };
jest.mock('../useReply', () => ({ useReply: () => mockReply }));
const mockEdit = { editing: false };
jest.mock('../useEdit', () => ({ useEdit: () => mockEdit }));
const mockGif = {};
jest.mock('../useGifPickerV2', () => ({ useGifPicker: () => mockGif }));

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';
import { useCompose, composeReducer, initialComposeState } from '../useCompose';
import { postSnapWithBeneficiaries } from '../../services/snapPostingService';

const mockPost = postSnapWithBeneficiaries as jest.Mock;
type Compose = ReturnType<typeof useCompose>;

function renderCompose(): { current: () => Compose } {
    let latest!: Compose;
    const Test = (): null => {
        latest = useCompose({ mode: 'blog' });
        return null;
    };
    act(() => { create(React.createElement(Test)); });
    return { current: () => latest };
}

const flush = (): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
    jest.clearAllMocks();
    mockVideo.videoEmbedUrl = null;
    mockPost.mockResolvedValue('tx');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('composeReducer', () => {
    it('keeps one entry per account and removes by account', () => {
        let s = composeReducer(initialComposeState, { type: 'ADD_BENEFICIARY', payload: { account: 'alice', weight: 1000 } });
        s = composeReducer(s, { type: 'ADD_BENEFICIARY', payload: { account: 'alice', weight: 1000 } });
        s = composeReducer(s, { type: 'ADD_BENEFICIARY', payload: { account: 'bob', weight: 500 } });
        expect(s.beneficiaries).toEqual([{ account: 'alice', weight: 1000 }, { account: 'bob', weight: 500 }]);
        s = composeReducer(s, { type: 'REMOVE_BENEFICIARY', payload: 'alice' });
        expect(s.beneficiaries).toEqual([{ account: 'bob', weight: 500 }]);
        expect(composeReducer(s, { type: 'CLEAR_FORM' }).beneficiaries).toEqual([]);
    });
});

it('counts beneficiaries as draft content and blocks publishing over 100%', async () => {
    const compose = renderCompose();
    await flush();
    act(() => {
        compose.current().setTitle('Hello world');
        compose.current().setText('Body');
    });
    act(() => compose.current().addBeneficiary({ account: 'alice', weight: 9700 }));
    expect(compose.current().hasDraftContent).toBe(true);
    expect(compose.current().canSubmit).toBe(true); // 3% + 97%

    act(() => compose.current().addBeneficiary({ account: 'bob', weight: 1 }));
    expect(compose.current().canSubmit).toBe(false);
});

it('publishes with the chosen beneficiaries and the shown @snapie share, then clears them', async () => {
    const compose = renderCompose();
    await flush();
    act(() => {
        compose.current().setTitle('Hello world');
        compose.current().setText('Body');
        compose.current().addBeneficiary({ account: 'alice', weight: 1000 });
    });
    expect(compose.current().snapieWeight).toBe(300);

    await act(async () => { await compose.current().submit(); });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][1]).toEqual(
        expect.objectContaining({
            author: 'meno',
            beneficiaries: [{ account: 'alice', weight: 1000 }],
            snapieWeight: 300,
        })
    );
    expect(compose.current().state.beneficiaries).toEqual([]);
});
