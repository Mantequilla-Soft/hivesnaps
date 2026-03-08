/**
 * Tests for imageConverter utility
 * Tests HEIC to JPEG conversion and smart conversion with ph:// URI handling
 */

import { convertToJPEG, convertMultipleToJPEG, convertImageSmart } from '../utils/imageConverter';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('expo-file-system/legacy');
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('imageConverter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
    // Default: cacheDirectory is available
    Object.defineProperty(FileSystem, 'cacheDirectory', {
      value: 'file:///cache/',
      writable: true,
      configurable: true,
    });
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

  describe('convertImageSmart', () => {
    describe('HEIC/HEIF conversion', () => {
      it('should convert HEIC to JPEG via ImageManipulator', async () => {
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file:///converted/image.jpg',
          width: 1920,
          height: 1440,
        });

        const result = await convertImageSmart('file:///test/photo.heic', 'photo.heic');

        expect(result.type).toBe('image/jpeg');
        expect(result.uri).toBe('file:///converted/image.jpg');
        expect(result.name).toMatch(/\.jpg$/);
      });

      it('should convert HEIF to JPEG via ImageManipulator', async () => {
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file:///converted/image.jpg',
          width: 800,
          height: 600,
        });

        const result = await convertImageSmart('file:///test/photo.heif', 'photo.heif');

        expect(result.type).toBe('image/jpeg');
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
      });
    });

    describe('GIF handling', () => {
      it('should preserve GIF file:// URIs without processing', async () => {
        const result = await convertImageSmart('file:///test/animation.gif', 'animation.gif');

        expect(result.type).toBe('image/gif');
        expect(result.uri).toBe('file:///test/animation.gif');
        expect(result.name).toBe('animation.gif');
        // Should not touch ImageManipulator or FileSystem
        expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
      });

      it('should normalize GIF ph:// URIs via copyAsync', async () => {
        Platform.OS = 'ios';
        (mockFileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

        const result = await convertImageSmart('ph://asset-123', 'animation.gif');

        expect(result.type).toBe('image/gif');
        expect(result.uri).toMatch(/^file:\/\/\/cache\/image-.*\.gif$/);
        expect(mockFileSystem.copyAsync).toHaveBeenCalled();
      });

      it('should fall back to ImageManipulator when copyAsync fails for GIF', async () => {
        Platform.OS = 'ios';
        (mockFileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('copyAsync failed'));
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file:///manipulated/image.jpg',
          width: 200,
          height: 200,
        });

        const result = await convertImageSmart('ph://asset-123', 'animation.gif');

        expect(result.type).toBe('image/gif');
        // Falls back to ImageManipulator URI
        expect(result.uri).toBe('file:///manipulated/image.jpg');
      });
    });

    describe('PNG handling', () => {
      it('should preserve PNG file:// URIs without processing', async () => {
        const result = await convertImageSmart('file:///test/logo.png', 'logo.png');

        expect(result.type).toBe('image/png');
        expect(result.uri).toBe('file:///test/logo.png');
        expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
      });

      it('should normalize PNG ph:// URIs via ImageManipulator', async () => {
        Platform.OS = 'ios';
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file:///manipulated/logo.png',
          width: 512,
          height: 512,
        });

        const result = await convertImageSmart('ph://asset-456', 'logo.png');

        expect(result.type).toBe('image/png');
        expect(result.uri).toBe('file:///manipulated/logo.png');
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
          'ph://asset-456',
          [],
          { format: ImageManipulator.SaveFormat.PNG }
        );
      });
    });

    describe('JPEG handling', () => {
      it('should pass through JPEG file:// URIs without processing', async () => {
        const result = await convertImageSmart('file:///test/photo.jpg', 'photo.jpg');

        expect(result.type).toBe('image/jpeg');
        expect(result.uri).toBe('file:///test/photo.jpg');
        expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
      });

      it('should normalize JPEG ph:// URIs via copyAsync', async () => {
        Platform.OS = 'ios';
        (mockFileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

        const result = await convertImageSmart('ph://asset-789', 'photo.jpg');

        expect(result.type).toBe('image/jpeg');
        expect(result.uri).toMatch(/^file:\/\/\/cache\/image-.*\.jpg$/);
      });

      it('should fall back to ImageManipulator when copyAsync fails for JPEG', async () => {
        Platform.OS = 'ios';
        (mockFileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('copyAsync failed'));
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file:///manipulated/photo.jpg',
          width: 1920,
          height: 1080,
        });

        const result = await convertImageSmart('ph://asset-789', 'photo.jpg');

        expect(result.type).toBe('image/jpeg');
        expect(result.uri).toBe('file:///manipulated/photo.jpg');
      });
    });

    describe('error handling', () => {
      it('should throw when both copyAsync and ImageManipulator fail', async () => {
        Platform.OS = 'ios';
        (mockFileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('copy failed'));
        (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error('manipulate failed'));

        await expect(convertImageSmart('ph://asset-fail', 'photo.jpg'))
          .rejects
          .toThrow('Failed to process image');
      });

      it('should throw when cacheDirectory is null', async () => {
        Platform.OS = 'ios';
        Object.defineProperty(FileSystem, 'cacheDirectory', {
          value: null,
          writable: true,
          configurable: true,
        });

        await expect(convertImageSmart('ph://asset-123', 'photo.jpg'))
          .rejects
          .toThrow('Cache directory unavailable');
      });
    });
  });
});
