/**
 * Inline, always-playing video surface for one Shorts card — the doomscroll
 * shape (full-bleed, no controls, looping, autoplay driven by scroll
 * position) as opposed to ThreeSpeakEmbed's tap-to-open modal player. Both
 * sit on the same underlying react-native-video + 3Speak HLS pipeline; only
 * the presentation differs.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Video from 'react-native-video';
import { fetchThreeSpeakVideoInfo } from '../../services/threeSpeakVideoService';

interface ShortVideoPlayerProps {
  author: string;
  permlink: string;
  thumbnailUrl: string;
  /** This is the one currently centered on screen — the only card that
   *  actually plays. */
  isActive: boolean;
  /** An immediate neighbor of the active card — mounted so its video can
   *  start buffering ahead of a swipe, but never audible or playing. */
  isPreload: boolean;
  /** Page-level mute toggle; only applied while this card is active —
   *  preload neighbors are always forced muted regardless. */
  muted: boolean;
}

export default function ShortVideoPlayer({
  author,
  permlink,
  thumbnailUrl,
  isActive,
  isPreload,
  muted,
}: ShortVideoPlayerProps) {
  const [cid, setCid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const shouldMount = isActive || isPreload;

  useEffect(() => {
    if (!shouldMount || cid || failed) return;
    let cancelled = false;

    const embedUrl = `https://play.3speak.tv/embed?v=${author}/${permlink}`;
    fetchThreeSpeakVideoInfo(embedUrl).then(info => {
      if (cancelled) return;
      if (info?.cid) setCid(info.cid);
      else setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldMount, author, permlink, cid, failed]);

  return (
    <View style={styles.container}>
      {thumbnailUrl ? (
        <ExpoImage
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit='cover'
        />
      ) : null}

      {shouldMount && cid ? (
        <Video
          source={{ uri: cid }}
          style={StyleSheet.absoluteFillObject}
          resizeMode='cover'
          paused={!isActive}
          muted={!isActive || muted}
          repeat
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch='ignore'
          onError={() => setFailed(true)}
        />
      ) : null}

      {isActive && !cid && !failed ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size='large' color='#fff' />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
