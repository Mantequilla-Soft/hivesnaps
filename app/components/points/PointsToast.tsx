import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTheme } from '../../../constants/Colors';
import { onPointsEarned } from '../../../utils/pointsEvents';

const VISIBLE_MS = 2500;
const ANIM_MS = 200;

// Mounted once at the app root (app/_layout.tsx) — earning can happen from
// the feed (vote), the compose flow (snap), or a reply modal, so this needs
// to render regardless of which screen is currently active.
export const PointsToast: React.FC = () => {
  const colorScheme = useColorScheme() || 'light';
  const theme = getTheme(colorScheme === 'dark' ? 'dark' : 'light');
  const [awarded, setAwarded] = useState<number | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onPointsEarned(detail => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setAwarded(detail.awarded);

      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: ANIM_MS, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
        ]).start(() => setAwarded(null));
      }, VISIBLE_MS);
    });
  }, [translateY, opacity]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (awarded === null) return null;

  return (
    <SafeAreaView style={styles.safeArea} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: theme.bubble, borderColor: theme.border, transform: [{ translateY }], opacity },
        ]}
      >
        <Text style={[styles.text, { color: theme.text }]}>+{awarded} points</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
});
