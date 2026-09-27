import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationBadge from './NotificationBadge';

interface BottomTabBarProps {
  /** Which feed is currently active on the screen this bar is mounted in —
   *  only meaningful while mounted on FeedScreen itself. */
  activeFeed: 'blogs' | 'snaps';
  onHomePress: () => void;
  onBlogsPress: () => void;
  username: string | null;
  colors: {
    background: string;
    text: string;
    icon: string;
    border: string;
  };
}

/**
 * Persistent bottom navigation, mirroring snapie.io's mobile tab bar shape:
 * destinations (Home/Blogs/Shorts/Profile) plus an elevated center Compose
 * button, kept separate from the feed's content filters (Following/Newest/
 * Trending), which stay as pills under the header instead of living here.
 * Deliberately 2 destinations on each side of the FAB so it sits dead
 * center — Hangouts lives in the feed's top bar instead (next to search),
 * its original home, rather than as a 5th tab here unbalancing the FAB.
 *
 * Rendered per-screen (currently just FeedScreen) rather than as a true
 * expo-router Tabs layout — the app's screens are a flat Stack, and
 * migrating that is a bigger, separate change from adding this bar.
 */
export default function BottomTabBar({
  activeFeed,
  onHomePress,
  onBlogsPress,
  username,
  colors,
}: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <Tab
        icon='home'
        label='Home'
        active={activeFeed === 'snaps'}
        color={colors.text}
        onPress={onHomePress}
      />
      <Tab
        icon='newspaper-o'
        label='Blogs'
        active={activeFeed === 'blogs'}
        color={colors.text}
        onPress={onBlogsPress}
      />

      <View style={styles.composeSlot}>
        <TouchableOpacity
          style={[styles.composeButton, { backgroundColor: colors.icon }]}
          onPress={() =>
            activeFeed === 'blogs'
              ? router.push({ pathname: '/screens/ComposeScreen', params: { mode: 'blog' } })
              : router.push('/screens/ComposeScreen')
          }
          accessibilityRole='button'
          accessibilityLabel={activeFeed === 'blogs' ? 'Create new blog post' : 'Create new snap'}
        >
          <FontAwesome name='plus' size={22} color='#fff' />
        </TouchableOpacity>
      </View>

      <Tab
        icon='play-circle'
        label='Shorts'
        active={false}
        color={colors.text}
        onPress={() => router.push('/screens/ShortsScreen')}
      />
      <Tab
        icon='user'
        label='Profile'
        active={false}
        color={colors.text}
        onPress={() => {
          if (username) {
            router.push({ pathname: '/screens/ProfileScreen', params: { username } });
          }
        }}
      />
    </View>
  );
}

interface TabProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  active: boolean;
  color: string;
  badgeCount?: number;
  onPress: () => void;
}

function Tab({ icon, label, active, color, badgeCount = 0, onPress }: TabProps) {
  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View style={{ position: 'relative' }}>
        <FontAwesome name={icon} size={20} color={color} style={{ opacity: active ? 1 : 0.6 }} />
        <NotificationBadge count={badgeCount} size='small' color='#FF3B30' visible={badgeCount > 0} />
      </View>
      <Text style={[styles.label, { color, opacity: active ? 1 : 0.6 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    zIndex: 999,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
  },
  composeSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
});
