# HEIC to JPEG Conversion

## Overview

This document explains the HEIC image format issue encountered in HiveSnaps and how we solved it to ensure cross-platform compatibility for image uploads.

## The Problem

### What is HEIC?

HEIC (High Efficiency Image Container) is Apple's default image format on iOS devices since iOS 11. While HEIC offers superior compression (roughly 50% smaller file sizes than JPEG with similar quality), it presents significant compatibility challenges:

- **Limited Browser Support**: Most web browsers cannot display HEIC images natively
- **Server Rejection**: Many image hosting services (including Hive's images.hive.blog) don't accept HEIC uploads
- **Cross-Platform Issues**: Android devices and older systems cannot view HEIC images

### How This Affected HiveSnaps

When iOS users selected images from their photo library, the images were often in HEIC format. This caused:

1. **Upload Failures**: The Hive image upload service rejected HEIC files with errors
2. **Invisible Images**: Even if uploaded elsewhere, images wouldn't display for non-iOS users
3. **Poor User Experience**: Users saw confusing error messages or broken image placeholders

### Error Symptoms

Users experienced:
- "Failed to upload image" errors
- Images appearing as broken links in posts
- Uploads succeeding locally but images not displaying in the feed

## The Solution

### Implementation Strategy

We implemented an automatic image conversion layer using Expo's `expo-image-manipulator` package. This converts all images to JPEG format before upload, ensuring universal compatibility.

### Key Components

#### 1. Image Converter Utility (`utils/imageConverter.ts`)

```typescript
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export async function convertToJPEG(
  uri: string,
  quality: number = 0.8
): Promise<ConvertedImage> {
  // Verify file exists
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error(`Image file not found: ${uri}`);
  }

  // Convert to JPEG using ImageManipulator
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [], // No transformations, just format conversion
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
```

**Key features:**
- Uses Expo's ImageManipulator for reliable format conversion
- Validates file existence before processing
- Configurable quality setting (default 0.8 for good balance)
- Returns converted file URI with dimensions

#### 2. Integration Points

The converter is integrated into all image upload flows:

**Reply Images (`hooks/useReply.ts`):**
```typescript
if (!result.canceled && result.assets && result.assets[0]) {
  const asset = result.assets[0];
  
  // Convert HEIC and other formats to JPEG
  const converted = await convertToJPEG(asset.uri, 0.8);

  const fileToUpload = {
    uri: converted.uri,
    name: `reply-${Date.now()}.jpg`,
    type: 'image/jpeg',
  };

  const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
}
```

**Edit Images (`hooks/useEdit.ts`):**
```typescript
// Convert HEIC and other formats to JPEG
const converted = await convertToJPEG(asset.uri, 0.8);
```

**Profile image uploads (`utils/pickImage.ts`, used by Edit Profile):**
```typescript
// Convert HEIC and other formats to JPEG
const converted = await convertToJPEG(asset.uri, 0.8);
```

### How It Works

1. **User selects image** from photo library via ImagePicker
2. **Image URI received** (could be HEIC, JPEG, PNG, etc.)
3. **convertToJPEG() called** with the original URI
4. **ImageManipulator processes** the image:
   - Reads the image data (handles HEIC natively on iOS)
   - Re-encodes as JPEG with specified quality
   - Saves to a new temporary file
5. **Converted URI returned** pointing to the new JPEG file
6. **Upload proceeds** with the universally compatible JPEG

### Quality Settings

We use 0.8 (80%) quality as the default, which provides:
- **Good visual quality**: Minimal perceptible degradation
- **Reasonable file sizes**: ~30-40% smaller than uncompressed
- **Fast uploads**: Balances quality with upload speed

For avatars and thumbnails, this quality is more than sufficient. For high-quality photo sharing, users could potentially increase this in the future.

## Testing

Comprehensive tests are located in `tests/imageConverter.test.ts`:

```typescript
describe('imageConverter', () => {
  it('should successfully convert a valid image to JPEG', async () => {
    const result = await convertToJPEG('file:///test/heic-image.heic', 0.8);
    expect(result.uri).toContain('.jpg');
  });

  it('should throw error if file does not exist', async () => {
    await expect(convertToJPEG('file:///nonexistent/image.heic', 0.8))
      .rejects.toThrow('Image file not found');
  });

  it('should handle multiple image conversions', async () => {
    const results = await convertMultipleToJPEG([
      'file:///test/image1.heic',
      'file:///test/image2.heic',
    ]);
    expect(results).toHaveLength(2);
  });
});
```

## Benefits

### For Users
- **Seamless experience**: No manual conversion needed
- **Universal compatibility**: Images work everywhere
- **Faster uploads**: JPEG compression reduces file sizes

### For the Platform
- **Reduced errors**: Eliminates HEIC-related upload failures
- **Consistent display**: All images render correctly across devices
- **Lower bandwidth**: Compressed images use less data

## Dependencies

```json
{
  "expo-image-manipulator": "~12.0.5",
  "expo-file-system": "~17.0.1"
}
```

## Future Considerations

1. **WebP Support**: Could add WebP as an option for even better compression
2. **Quality Selection**: Allow users to choose quality levels
3. **Original Format Preservation**: For platforms that support HEIC, could skip conversion
4. **Batch Processing**: Optimize multiple image conversions for gallery uploads

## Related Files

- `utils/imageConverter.ts` - Core conversion utility
- `hooks/useReply.ts` - Reply image upload integration
- `hooks/useEdit.ts` - Edit image upload integration  
- `utils/pickImage.ts` - Avatar / cover upload integration (Edit Profile)
- `tests/imageConverter.test.ts` - Unit tests

## Commit History

- `28e7577` - feat: add HEIC to JPEG conversion for iOS compatibility
- `dfde9ff` - Consolidate test folders: move all tests from test/ to tests/
