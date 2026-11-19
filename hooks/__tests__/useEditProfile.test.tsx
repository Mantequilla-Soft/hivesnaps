jest.mock('../../services/ProfileService', () => ({ fetchProfileFields: jest.fn(), saveProfileFields: jest.fn() }));
jest.mock('../../services/AvatarService', () => ({ avatarService: { clearCache: jest.fn() } }));
jest.mock('../../utils/pickImage', () => ({ pickImage: jest.fn(), uploadPickedImage: jest.fn() }));
const mockSetUserProfile = jest.fn();
const mockGetUserProfile = jest.fn();
jest.mock('../../store/context', () => ({
    useAppStore: () => ({ setUserProfile: mockSetUserProfile, selectors: { getUserProfile: mockGetUserProfile } }),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useEditProfile, type UseEditProfileResult } from '../useEditProfile';
import { fetchProfileFields, saveProfileFields } from '../../services/ProfileService';
import { avatarService } from '../../services/AvatarService';
import { pickImage, uploadPickedImage } from '../../utils/pickImage';
import { EMPTY_PROFILE } from '../../utils/profileMetadata';

const onChain = { ...EMPTY_PROFILE, name: 'Meno', profile_image: 'https://img/old.png' };

function render(): { current: () => UseEditProfileResult } {
    let latest!: UseEditProfileResult;
    const Test = (): null => {
        latest = useEditProfile('meno');
        return null;
    };
    act(() => { create(React.createElement(Test)); });
    return { current: () => latest };
}
const flush = (): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
    jest.clearAllMocks();
    (fetchProfileFields as jest.Mock).mockResolvedValue(onChain);
    (saveProfileFields as jest.Mock).mockImplementation(async (_u, f) => f);
    mockGetUserProfile.mockReturnValue({ name: 'meno', reputation: 70 });
});

it('loads the profile and tracks unsaved changes', async () => {
    const h = render();
    await flush();
    expect(h.current().loading).toBe(false);
    expect(h.current().fields).toEqual(onChain);
    expect(h.current().dirty).toBe(false);

    act(() => h.current().setField('about', 'Hello'));
    expect(h.current().dirty).toBe(true);
    act(() => h.current().setField('website', 'nope'));
    expect(h.current().error).toMatch(/web address/);
});

it('uploads a picked image into the field, and does nothing when cancelled', async () => {
    const h = render();
    await flush();
    (pickImage as jest.Mock).mockResolvedValueOnce(null);
    await act(async () => { await h.current().changeImage('cover_image'); });
    expect(uploadPickedImage).not.toHaveBeenCalled();

    (pickImage as jest.Mock).mockResolvedValueOnce({ uri: 'file://c.jpg' });
    (uploadPickedImage as jest.Mock).mockResolvedValueOnce('https://img/cover.jpg');
    await act(async () => { await h.current().changeImage('cover_image'); });
    expect(pickImage).toHaveBeenLastCalledWith({ title: 'Cover image', square: false });
    expect(h.current().fields.cover_image).toBe('https://img/cover.jpg');
    expect(h.current().uploading).toBeNull();
});

it('saves, updates the cached profile without dropping its other fields, and refreshes the avatar cache', async () => {
    const h = render();
    await flush();
    act(() => {
        h.current().setField('about', 'Hello');
        h.current().setField('profile_image', 'https://img/new.png');
    });
    await act(async () => { await h.current().save(); });

    expect(saveProfileFields).toHaveBeenCalledWith('meno', expect.objectContaining({ about: 'Hello', profile_image: 'https://img/new.png' }), onChain);
    expect(mockSetUserProfile).toHaveBeenCalledWith(
        'meno',
        expect.objectContaining({ reputation: 70, about: 'Hello', displayName: 'Meno', profile_image: 'https://img/new.png' })
    );
    expect(avatarService.clearCache).toHaveBeenCalled();
    expect(h.current().dirty).toBe(false);
});

it('keeps the edits when saving fails', async () => {
    (saveProfileFields as jest.Mock).mockRejectedValueOnce(new Error('rejected'));
    const h = render();
    await flush();
    act(() => h.current().setField('about', 'Hello'));
    await act(async () => { await expect(h.current().save()).rejects.toThrow('rejected'); });
    expect(h.current().fields.about).toBe('Hello');
    expect(h.current().dirty).toBe(true);
    expect(h.current().saving).toBe(false);
    expect(mockSetUserProfile).not.toHaveBeenCalled();
});
