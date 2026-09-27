import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useVotingPower } from '../../../hooks/useVotingPower';
import { useResourceCredits } from '../../../hooks/useResourceCredits';
import { formatVotingPower } from '../../../utils/calculateVotingPower';
import StaticContentModal from '../../../components/StaticContentModal';

const VP_MODAL_CONTENT = {
  title: 'What is Voting Power (VP)?',
  content: `Voting Power (VP) is a measure of your ability to upvote posts and comments on the Hive blockchain. The higher your VP, the more influence your votes have.

- VP decreases each time you upvote.
- VP regenerates automatically over time (about 20% per day).
- Keeping your VP high means your votes have more impact.

You can see your current VP here on your profile, and again when you vote. After upvoting, your VP will drop slightly and recharge over time.`,
};

const RC_MODAL_CONTENT = {
  title: 'What are Resource Credits (RC)?',
  content: `Resource Credits are like digital fuel. You need them to do things on Hive, like posting, voting, or making transactions. Every account has them, and using the network costs a small amount each time.

How can I get more?

• Power Up Hive: The more Hive Power you have, the more RC you get.

• Ask for a Delegation: A friend or community can temporarily boost your RC by delegating Hive Power.

• Use a Faucet or Service: Some apps or websites offer small amounts of RC for free.

Don't worry—RC recharges over time!

Even if you're out of credits, just wait a bit. Your RC will slowly refill, and you'll be able to use Hive again without doing anything else.`,
};

interface ColorScheme {
  background: string;
  text: string;
  textSecondary: string;
  bubble: string;
  border: string;
  button: string;
  buttonText: string;
}

interface VotingPowerSectionProps {
  isOwnProfile: boolean;
  username: string;
  colors: ColorScheme;
}

/**
 * Voting Power / Resource Credits readout — moved here from the feed header
 * to keep the feed screen focused on content. Own-profile only: both are a
 * measure of what YOU can currently do on-chain, not a stat about the
 * profile being viewed.
 */
export const VotingPowerSection: React.FC<VotingPowerSectionProps> = ({
  isOwnProfile,
  username,
  colors,
}) => {
  const { votingPower } = useVotingPower();
  const { resourceCredits } = useResourceCredits(isOwnProfile ? username : null);
  const [vpModalVisible, setVpModalVisible] = useState(false);
  const [rcModalVisible, setRcModalVisible] = useState(false);

  if (!isOwnProfile) return null;

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bubble, borderColor: colors.border },
        ]}
      >
        <Pressable
          style={styles.stat}
          onPress={() => setVpModalVisible(true)}
          accessibilityRole='button'
          accessibilityLabel='Show Voting Power info'
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Voting Power
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {votingPower !== null ? `${formatVotingPower(votingPower)}%` : '--'}
          </Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          style={styles.stat}
          onPress={() => setRcModalVisible(true)}
          accessibilityRole='button'
          accessibilityLabel='Show Resource Credits info'
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Resource Credits
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {resourceCredits !== null ? `${resourceCredits.toFixed(1)}%` : '--'}
          </Text>
        </Pressable>
      </View>

      <StaticContentModal
        visible={vpModalVisible}
        onClose={() => setVpModalVisible(false)}
        title={VP_MODAL_CONTENT.title}
        content={VP_MODAL_CONTENT.content}
        colors={colors}
        closeButtonAccessibilityLabel='Close Voting Power info'
      />
      <StaticContentModal
        visible={rcModalVisible}
        onClose={() => setRcModalVisible(false)}
        title={RC_MODAL_CONTENT.title}
        content={RC_MODAL_CONTENT.content}
        colors={colors}
        closeButtonAccessibilityLabel='Close Resource Credits info'
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '100%',
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
