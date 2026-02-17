import React from 'react';
import { View, Text, Image, StyleSheet, useColorScheme } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getTheme } from '../../constants/Colors';

export default function SnapMock() {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    bubble: theme.bubble,
    border: theme.border,
    icon: theme.icon,
    payout: theme.payout,
  };

  return (
    <View
      style={[
        styles.bubble,
        { backgroundColor: colors.bubble, borderColor: colors.border },
      ]}
    >
      {/* Top row: avatar, username, timestamp */}
      <View style={styles.topRow}>
        <Image
          source={require('../../assets/images/generic-avatar.png')}
          style={styles.avatar}
        />
        <Text style={[styles.username, { color: colors.text }]}>menoshops</Text>
        <Text style={[styles.timestamp, { color: colors.text }]}>
          2025-06-24 14:32
        </Text>
      </View>
      {/* Body */}
      <Text style={[styles.body, { color: colors.text }]}>
        This is a sample Snap! It can contain text, and later images or videos.
      </Text>
      {/* VoteReplyBar */}
      <View style={styles.voteBar}>
        <FontAwesome
          name='arrow-up'
          size={18}
          color={colors.icon}
          style={styles.icon}
        />
        <Text style={[styles.voteCount, { color: colors.text }]}>12</Text>
        <FontAwesome
          name='comment-o'
          size={18}
          color={colors.icon}
          style={styles.icon}
        />
        <Text style={[styles.replyCount, { color: colors.text }]}>3</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.payout, { color: colors.payout }]}>$2.34</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#E1E8ED',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 13,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  body: {
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 2,
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginRight: 4,
  },
  voteCount: {
    marginRight: 12,
    fontSize: 14,
  },
  replyCount: {
    marginRight: 12,
    fontSize: 14,
  },
  payout: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});
