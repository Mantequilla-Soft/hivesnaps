# Native Video Player Migration (3Speak)

**Status:** Ready for Implementation  
**Date:** February 18, 2026  
**Owner:** Video Team  
**Priority:** High (Performance, UX improvement)  
**API Status:** ✅ Deployed & Production-Ready

---

## Background

The current 3Speak video player uses `react-native-webview` with heavy JavaScript injection to handle playback and fullscreen. This approach has several limitations:

- **Slow WebView boot time** — each video initializes an entire browser engine
- **Complex fullscreen handling** — separate platform-specific components (`.ios.tsx` / `.android.tsx`) with injected JS polling
- **Limited controls** — custom overlays instead of native player controls
- **Performance impact** — WebView consumes significant memory on low-end devices

**The fix:** Replace WebView with native video player (`react-native-video`) by calling the Snapie HTML5 player API with an `info=true` flag to fetch CID + metadata, then play the HLS stream directly using native ExoPlayer (Android) / AVPlayer (iOS).

---

## Architecture Overview

```
Post/Snap Content
       ↓
extractVideoInfo() → detects URL (watch or embed)
       ↓
ThreeSpeakEmbed (React component)
       ↓
threeSpeakVideoService.fetchThreeSpeakVideoInfo()
       ↓
Snapie Player API (/api/watch?v=user/id&info=true)
       ↓
API Response: { cid (HTTPS URL), thumbnail (HTTPS URL), views, short? }
       ↓
react-native-video (native player)
       ↓
ExoPlayer (Android) / AVPlayer (iOS)
```

---

## Snapie Player API Spec

The Snapie player now exposes a lightweight info endpoint that returns video metadata optimized for native mobile playback. All URLs are production-ready—no client-side conversion needed.

### Endpoints

**Legacy Videos (Web Recorder):**

```
GET /api/watch?v=owner/permlink&info=true
```

**Embed Videos (Snapie Mobile):**

```
GET /api/embed?v=owner/permlink&info=true
```

### Response Format

**Legacy Video Response:**

```json
{
  "cid": "https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxxx/manifest.m3u8",
  "thumbnail": "https://hotipfs-3speak-1.b-cdn.net/ipfs/QmYyyy",
  "views": 42
}
```

**Embed Video Response:**

```json
{
  "cid": "https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxxx/manifest.m3u8",
  "thumbnail": "https://hotipfs-3speak-1.b-cdn.net/ipfs/QmYyyy",
  "short": true,
  "views": 3
}
```

### Field Descriptions

| Field       | Type               | Description                                                                     | Notes                                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `cid`       | string (HTTPS URL) | Full CDN URL pointing to HLS manifest. Ready to pass directly to native player. | Always includes `/manifest.m3u8` suffix                 |
| `thumbnail` | string (HTTPS URL) | Full CDN URL for thumbnail image. Pass directly to image component.             | Pre-validated; never null (uses placeholder if missing) |
| `short`     | boolean            | Embed videos only. Indicates short-form video format.                           | Omitted in legacy `/watch` responses                    |
| `views`     | number             | Current view count.                                                             | Present in both response types                          |

### Data Trust & Validation

**All URLs are production-ready:**

- CDN URLs use BunnyCDN hotnode (`hotipfs-3speak-1.b-cdn.net`) as primary gateway
- Server handles all IPFS-to-CDN conversion
- Server handles all `ipfs://` CID references
- Server handles HTTPS image URLs (from `images.hive.blog`) pass-through
- Deleted/processing/failed videos automatically return appropriate placeholder CIDs

**No client-side conversion needed** — just use URLs as-is.

### Status Handling

Server automatically handles video state:

- **Published** → Returns actual video CID + thumbnail
- **Processing/Uploading** → Returns processing placeholder CID
- **Deleted/Failed** → Returns appropriate placeholder CID
- **Not Found** → Returns HTTP 404

**No client logic needed** — trust the CID returned and play it.

### Response Behavior

- **Success (200):** Return JSON object as above
- **Video not found (404):** App will fall back to default video CID
- **Server error (5xx):** App will fall back to default video CID
- **Network timeout:** App handles gracefully with fallback

---

## App-Side Implementation

### 1. New Dependency

Add to `package.json`:

```json
"react-native-video": "^5.2.1"
```

**Build:** Will require rebuild (`npx expo run:ios` / `npx expo run:android`) as it links native code.

### 2. New Files

#### `services/threeSpeakVideoService.ts`

Fetches video metadata from Snapie player API.

```typescript
interface ThreeSpeakVideoResponse {
  cid: string; // Full HTTPS URL to HLS manifest
  thumbnail: string; // Full HTTPS URL to thumbnail image
  views: number;
  short?: boolean; // Only present in embed responses
}

export async function fetchThreeSpeakVideoInfo(
  originalUrl: string
): Promise<ThreeSpeakVideoResponse | null>;
```

**Logic:**

1. Validate input is a valid 3Speak URL (contains `/watch` or `/embed`)
2. Append `&info=true` to URL (e.g., `/api/watch?v=user/id&info=true`)
3. Fetch URL
4. Parse JSON response: `{ cid, thumbnail, views, short? }`
5. Return response object (URLs are already production-ready)
6. On any error (network, parse, 404, 5xx): return `null`

**Key difference from original plan:** No CID-to-URL conversion needed. Server returns full HTTPS URLs ready to use.

### 3. Modified Files

#### `app/components/ThreeSpeakEmbed.tsx` (rewrite)

**Current Props:**

```typescript
interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}
```

**Props:** No changes — keep same interface for compatibility with Snap.tsx and PostBody.tsx

**Implementation:**

- Extract `originalUrl` from `embedUrl` prop (strip query params like `mode=iframe&layout=mobile`)
- On mount: call `fetchThreeSpeakVideoInfo(originalUrl)`
- State: `{ cid, thumbnail, isLoading, error }`
- On fetch error: use fallback `defaultCid = process.env.EXPO_PUBLIC_DEFAULT_VIDEO_CID` (already a full HTTPS URL)
- Render:
  - **Loading:** Spinner in 1:1 square container
  - **Success/Fallback:** `Video` component from `react-native-video` with:
    - Source: `{ uri: cid }` (the full HTTPS URL)
    - Poster: `thumbnail` image (acts as loading image)
    - Controls: `true` (native player controls)
    - AspectRatio: 1:1 in default view, full device orientation in fullscreen
    - `allowsFullscreen: true`
    - `allowsPictureInPicture: true`

**Styling:**

- Default view: 1:1 square container, calculated from screen width minus padding (matching current behavior)
- Border radius: 12px
- Fullscreen: device orientation respected (pillarbox 16:9 videos in landscape if needed)
- Use [constants/Colors.ts](constants/Colors.ts) for loading spinner + error UI colors

**No more:**

- `.ios.tsx` platform file
- `.android.tsx` platform file
- Injected JavaScript
- `onMessage` handlers for fullscreen events
- WebView ref

#### `.env` or `app.json` (add env var)

**Option 1 — `.env` file:**

```
EXPO_PUBLIC_DEFAULT_VIDEO_CID=https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxxx/manifest.m3u8
```

**Option 2 — `app.json`:**

```json
{
  "expo": {
    "extra": {
      "defaultVideoCid": "https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxxx/manifest.m3u8"
    }
  }
}
```

**Note:** This must be a full HTTPS URL (production-ready), not just a CID.

### 4. Deleted Files

Remove since single `ThreeSpeakEmbed.tsx` now works on both platforms:

- `app/components/ThreeSpeakEmbed.ios.tsx`
- `app/components/ThreeSpeakEmbed.android.tsx`

### 5. No Changes Required

These files remain untouched:

- `utils/extractVideoInfo.ts` — already provides `originalUrl`
- `app/components/Snap.tsx` — already passes `embedUrl` + `isDark`
- `app/components/PostBody.tsx` — already passes `embedUrl` + `isDark`

---

## Implementation Checklist

### React Native App

- [ ] Create a new git branch from `main` (e.g., `feat/native-video-player`)
- [ ] Install `react-native-video` dependency (`npm install react-native-video`)
- [ ] Create `services/threeSpeakVideoService.ts` with API fetch logic (no CID conversion needed)
- [ ] Rewrite `app/components/ThreeSpeakEmbed.tsx` with native player
- [ ] Update extraction logic to properly strip query params from `embedUrl` prop
- [ ] Delete `app/components/ThreeSpeakEmbed.ios.tsx`
- [ ] Delete `app/components/ThreeSpeakEmbed.android.tsx`
- [ ] Add `EXPO_PUBLIC_DEFAULT_VIDEO_CID` to `.env` (full HTTPS URL format)
- [ ] Rebuild native binaries: `npx expo run:ios` and `npx expo run:android`
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Test fullscreen + orientation change
- [ ] Test network error → fallback to default video
- [ ] Test both watch and embed URL paths
- [ ] Performance profile: compare memory usage vs WebView approach
- [ ] Open pull request for code review before merging to main

### Server (Snapie Player)

- [ ] ✅ Implement `/api/watch?v=owner/permlink&info=true` endpoint
- [ ] ✅ Implement `/api/embed?v=owner/permlink&info=true` endpoint
- [ ] ✅ Return full HTTPS URLs for `cid` and `thumbnail`
- [ ] ✅ Handle video state (processing, deleted, failed) → placeholder CIDs
- [ ] ✅ Return 404 for missing videos
- [ ] ✅ Response time < 500ms
- [ ] ✅ Deploy to production

---

## Testing & Verification

### API Testing (Snapie Player)

Before starting app development, verify the API is working:

```bash
# Legacy video
curl -s "http://localhost:3005/api/watch?v=oluthomas/a6359d23&info=true" | jq

# Embed video
curl -s "http://localhost:3005/api/embed?v=elsalvadorian/rkhob0ys&info=true" | jq
```

Expected response:

- `cid` is a full HTTPS URL ending with `/manifest.m3u8`
- `thumbnail` is a full HTTPS URL
- `views` is a number
- `short` is present only in embed responses

### Manual Testing (React Native App)

1. **Normal video playback:**
   - Open post/snap with 3Speak video (watch URL)
   - Should show 1:1 square player with loading spinner
   - Spinner disappears when video loads
   - Native controls visible (pause, seek, volume)
   - Tap play → video plays smoothly
   - No WebView, no injected JavaScript

2. **Embed URL format:**
   - Open post/snap with 3Speak embed URL
   - Behavior identical to watch URL
   - Correct API endpoint used (`/api/embed`)

3. **Fullscreen:**
   - Tap fullscreen button (or double-tap video)
   - Device orientation respected
   - 16:9 video in landscape mode pillarboxes correctly (black bars on sides)
   - Landscape video in portrait mode pillarboxes correctly (black bars top/bottom)
   - Dismiss fullscreen returns to feed

4. **Network error handling:**
   - Disconnect WiFi/cellular
   - Open post with 3Speak video
   - Should show default video (from env CID) after API call fails
   - No error message/crash
   - Video plays smoothly

5. **Performance:**
   - Record time from component mount to playable video
   - Should be 2-3 seconds (API call + HLS load)
   - Noticeably faster than WebView approach
   - No memory leaks on repeated video views (profile with Xcode/Android Studio)

### Automated Testing

```typescript
// services/__tests__/threeSpeakVideoService.test.ts
import { fetchThreeSpeakVideoInfo } from '../threeSpeakVideoService';

describe('threeSpeakVideoService', () => {
  it('should fetch video info and return HTTPS URLs', async () => {
    const url =
      'https://play.3speak.tv/watch?v=user/videoid&mode=iframe&layout=mobile';
    const result = await fetchThreeSpeakVideoInfo(url);

    expect(result).toEqual(
      expect.objectContaining({
        cid: expect.stringMatching(/^https:\/\/.*manifest\.m3u8$/),
        thumbnail: expect.stringMatching(/^https:\/\//),
        views: expect.any(Number),
      })
    );
  });

  it('should return null on network error', async () => {
    const result = await fetchThreeSpeakVideoInfo(
      'https://invalid.url/watch?v=x'
    );
    expect(result).toBeNull();
  });

  it('should handle embed URLs with short field', async () => {
    const url = 'https://play.3speak.tv/embed?v=user/videoid';
    const result = await fetchThreeSpeakVideoInfo(url);

    expect(result).toHaveProperty('short');
    expect(typeof result?.short).toBe('boolean');
  });
});
```

---

## Rollback Plan

If issues arise:

1. Git revert commits related to video player migration
2. Restore `ThreeSpeakEmbed.ios.tsx` and `ThreeSpeakEmbed.android.tsx` from git history
3. Remove `react-native-video` from dependencies
4. Rebuild app with `npx expo run:ios` / `npx expo run:android`

---

## Future Improvements

- Manual fallback gateway logic in `ThreeSpeakEmbed.tsx` if primary gateway fails (via `onError` handler)
- Caching of video metadata for faster repeated plays
- Migrate `AudioEmbed.tsx` to native player as well
- Consider HLS adaptive bitrate selection options (expose in player controls)
- Analytics: track video play events, completion, seek behavior

---

## Timeline Estimate

- App-side native player implementation: **3-4 hours** (simpler now that server handles URL conversion)
- iOS simulator testing + debugging: **1-2 hours**
- Android emulator testing + debugging: **1-2 hours**
- QA/verification on both platforms: **1-2 hours**
- **Total: ~6-10 hours** (1 full development day + QA)

---

## Deployment Strategy

1. **Create feature branch:** `git checkout -b feat/native-video-player`
2. **Implement changes** (see Implementation Checklist)
3. **Test thoroughly** on both platforms
4. **Open PR** for code review
5. **Deploy to staging/internal testing** before public release
6. **Monitor playback logs** for 1-2 days (check for errors, performance)
7. **Merge to main** and release in next build

---

## Rollback Plan

If critical issues arise post-release:

1. Temporarily revert to WebView by reverting commits to main
2. Restore `ThreeSpeakEmbed.ios.tsx` and `ThreeSpeakEmbed.android.tsx` from git history
3. Rebuild and deploy hotfix
4. Investigate issue; fix and re-release native player version

---

## Future Improvements

- Advanced HLS features: adaptive bitrate monitoring, quality selection UI
- Cache video metadata for offline playback (store CID + metadata in local DB)
- Migrate `AudioEmbed.tsx` to native player using `expo-av`
- Analytics: track video play events, completion rate, seek behavior, fullscreen usage
- Picture-in-picture for multi-tasking
- Subtitle/closed caption support (if HLS manifest includes)
- Download for offline watching

---

## Key Implementation Notes

### URL Extraction

The `embedUrl` prop currently has the format:

```
https://play.3speak.tv/watch?v=username/videoid&mode=iframe&layout=mobile
```

For the API call, strip the `mode` and `layout` params:

```typescript
const originalUrl = embedUrl
  .split('&mode=')[0] // Remove mode param
  .split('&layout=')[0]; // Remove layout param
// Result: https://play.3speak.tv/watch?v=username/videoid
```

Then append `&info=true` for the API call.

### Error Handling Pattern

```typescript
const fetchVideoInfo = async () => {
  try {
    const info = await fetchThreeSpeakVideoInfo(originalUrl);
    if (info) {
      setCid(info.cid);
      setThumbnail(info.thumbnail);
    } else {
      // API returned null (404, error, etc.)
      setError(true);
      setCid(defaultCid); // Use fallback
    }
  } catch (err) {
    // Network error, parse error, etc.
    console.warn('Failed to fetch video info:', err);
    setError(true);
    setCid(defaultCid); // Use fallback
  }
};
```

### react-native-video Import

Use the `Video` component from react-native-video:

```typescript
import { Video } from 'react-native-video';

// Usage
<Video
  source={{ uri: cid }}
  style={{ width: '100%', aspectRatio: 1 }}
  controls={true}
  poster={thumbnail}
  allowsFullscreen={true}
/>
```

---

## Questions & Notes

- Default video CID: Provide the AI-generated fallback video as a full HTTPS URL (e.g., `https://hotipfs-3speak-1.b-cdn.net/ipfs/QmXxx/manifest.m3u8`)
- API is production-ready and deployed ✅
- No client-side URL conversion needed ✅
- Ready to start implementation whenever
