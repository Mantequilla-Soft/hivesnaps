/** WebP is re-encoded to JPEG, not passed through with a JPEG label. */
jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://converted.jpg', width: 10, height: 10 }),
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file://cache/', copyAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import * as ImageManipulator from 'expo-image-manipulator';
import { convertImageSmart } from '../imageConverter';

beforeEach(() => jest.clearAllMocks());

it('converts a WebP image to a real JPEG', async () => {
    const result = await convertImageSmart('file://shot.webp', 'shot.webp');
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('file://shot.webp', [], expect.objectContaining({ format: 'jpeg' }));
    expect(result).toEqual(expect.objectContaining({ uri: 'file://converted.jpg', type: 'image/jpeg' }));
    expect(result.name).toMatch(/\.jpg$/);
});

it('still passes a PNG file through untouched', async () => {
    const result = await convertImageSmart('file://shot.png', 'shot.png');
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ uri: 'file://shot.png', type: 'image/png' }));
});
