import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAppColors } from '../styles/colors';
import { formatPendingRewards, type PendingRewards } from '../../utils/pendingRewards';

interface PendingRewardsBannerProps {
  rewards: PendingRewards;
  onPress: () => void;
  onDismiss: () => void;
}

/** "You have rewards to claim" strip shown above the home feed. */
const PendingRewardsBanner: React.FC<PendingRewardsBannerProps> = ({ rewards, onPress, onDismiss }) => {
  const colors = useAppColors();
  const amount = formatPendingRewards(rewards);

  return (
    <View style={[styles.container, { backgroundColor: colors.bubble, borderColor: colors.payout }]}>
      <Pressable
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}
        onPress={onPress}
        accessibilityRole='button'
        accessibilityLabel={`You have rewards to claim: ${amount}. Open your profile to claim.`}
      >
        <FontAwesome name='gift' size={18} color={colors.payout} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.text }]}>Rewards ready to claim</Text>
          <Text style={[styles.amount, { color: colors.payout }]} numberOfLines={1}>
            {amount}
          </Text>
        </View>
        <Text style={[styles.cta, { color: colors.button }]}>Claim ›</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        style={styles.close}
        accessibilityRole='button'
        accessibilityLabel='Dismiss rewards banner'
      >
        <FontAwesome name='times' size={16} color={colors.textSecondary} />
      </Pressable>
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
  close: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
