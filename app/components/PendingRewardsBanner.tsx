import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAppColors } from '../styles/colors';
import { formatPendingRewards, type PendingRewards } from '../../utils/pendingRewards';

interface PendingRewardsBannerProps {
  rewards: PendingRewards;
  onPress: () => void;
  /** Omit to hide the close button (e.g. in the wallet, where it isn't a nag). */
  onDismiss?: () => void;
  /** Defaults to "Claim ›"; the action label shown on the right. */
  ctaLabel?: string;
  /** Screen-reader hint for what tapping does; defaults to opening the profile. */
  actionHint?: string;
  loading?: boolean;
  /**
   * Optional extra control (e.g. a "What is this?" button) rendered after the
   * claim button as its own sibling, so screen readers can focus it separately.
   */
  accessory?: React.ReactNode;
}

/** "You have rewards to claim" strip shown above the home feed and in the wallet. */
const PendingRewardsBanner: React.FC<PendingRewardsBannerProps> = ({
  rewards,
  onPress,
  onDismiss,
  ctaLabel = 'Claim ›',
  actionHint = 'Open your profile to claim.',
  loading = false,
  accessory,
}) => {
  const colors = useAppColors();
  const amount = formatPendingRewards(rewards);

  return (
    <View style={[styles.container, { backgroundColor: colors.bubble, borderColor: colors.payout }]}>
      <Pressable
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}
        onPress={onPress}
        disabled={loading}
        accessibilityRole='button'
        accessibilityLabel={`You have rewards to claim: ${amount}. ${actionHint}`}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        <FontAwesome name='gift' size={18} color={colors.payout} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.text }]}>Rewards ready to claim</Text>
          <Text style={[styles.amount, { color: colors.payout }]} numberOfLines={1}>
            {amount}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator size='small' color={colors.button} style={styles.cta} />
        ) : (
          <Text style={[styles.cta, { color: colors.button }]}>{ctaLabel}</Text>
        )}
      </Pressable>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          style={styles.close}
          accessibilityRole='button'
          accessibilityLabel='Dismiss rewards banner'
        >
          <FontAwesome name='times' size={16} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <View style={styles.noClose} />
      )}
    </View>
  );
};

export default PendingRewardsBanner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  icon: {
    marginRight: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  accessory: {
    paddingLeft: 4,
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cta: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  noClose: {
    width: 12,
  },
  close: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
