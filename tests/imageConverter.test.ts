/**
 * Tests for imageConverter utility
 * Tests HEIC to JPEG conversion functionality
 */

import { convertToJPEG, convertMultipleToJPEG } from '../utils/imageConverter';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

// Mock dependencies
jest.mock('expo-file-system/legacy');
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

describe('imageConverter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  describe('convertToJPEG', () => {
    it('should successfully convert a valid image to JPEG', async () => {
      // Mock manipulateAsync response (handles both file:// and ph:// URIs)
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      const result = await convertToJPEG('file:///test/heic-image.heic', 0.8);

      expect(result).toEqual({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      // Verify ImageManipulator was called with correct params
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file:///test/heic-image.heic',
        [],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
    });

    it('should throw error if ImageManipulator fails to access file', async () => {
      // Now ImageManipulator handles file access directly and will throw if file doesn't exist
      const testError = new Error('File not found');
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(testError);

      await expect(convertToJPEG('file:///nonexistent/image.heic', 0.8))
        .rejects
        .toThrow('Failed to convert image to JPEG');
    });

    it('should use default quality parameter', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      await convertToJPEG('file:///test/image.heic');

      // Verify default quality of 0.8 was used
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          compress: 0.8,
        })
      );
    });

    it('should handle conversion errors gracefully', async () => {
      const testError = new Error('ImageManipulator failed');
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(testError);

      await expect(convertToJPEG('file:///test/image.heic', 0.8))
        .rejects
        .toThrow('Failed to convert image to JPEG');
    });

    it('should respect custom quality parameter', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      await convertToJPEG('file:///test/image.heic', 0.95);

      // Verify custom quality was used
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
    });
  });

  describe('convertMultipleToJPEG', () => {
    it('should convert multiple images in parallel', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      const uris = [
        'file:///test/image1.heic',
        'file:///test/image2.heic',
        'file:///test/image3.heic',
      ];

      const results = await convertMultipleToJPEG(uris, 0.8);

      expect(results).toHaveLength(3);
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);

      // Verify all results have the correct structure
      results.forEach(result => {
        expect(result).toHaveProperty('uri');
        expect(result).toHaveProperty('width');
        expect(result).toHaveProperty('height');
      });
    });

    it('should handle empty array', async () => {
      const results = await convertMultipleToJPEG([], 0.8);
      expect(results).toEqual([]);
      expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    });

    it('should reject if any conversion fails', async () => {
      // First two succeed, third fails
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({ uri: 'file:///converted/1.jpg', width: 100, height: 100 })
        .mockResolvedValueOnce({ uri: 'file:///converted/2.jpg', width: 100, height: 100 })
        .mockRejectedValueOnce(new Error('Conversion failed'));

      const uris = [
        'file:///test/image1.heic',
        'file:///test/image2.heic',
        'file:///test/image3.heic',
      ];

      await expect(convertMultipleToJPEG(uris, 0.8))
        .rejects
        .toThrow();
    });

    it('should use default quality parameter', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///converted/image.jpg',
        width: 1920,
        height: 1440,
      });

      await convertMultipleToJPEG(['file:///test/image.heic']);

      // Verify default quality was used
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          compress: 0.8,
        })
      );
    });
  });
});
