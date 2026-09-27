import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { FontAwesome } from '@expo/vector-icons';
import { formatVotingPower } from '../utils/calculateVotingPower';

interface UpvoteModalProps {
  visible: boolean;
  voteWeight: number;
  voteValue: { hbd: string; usd: string } | null;
  voteWeightLoading: boolean;
  upvoteLoading: boolean;
  upvoteSuccess: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onVoteWeightChange: (weight: number) => void;
  /** Current voting power (0-100), shown alongside the weight slider so the
   *  cost of this vote is visible at the moment it's actually decided — VP
   *  no longer has a permanent spot in the feed header. Optional/omitted
   *  while it's still loading. */
  votingPower?: number | null;
  colors: {
    background: string;
    text: string;
    button: string;
    buttonText: string;
    buttonInactive: string;
    icon: string;
  };
}

const UpvoteModal: React.FC<UpvoteModalProps> = ({
  visible,
  voteWeight,
  voteValue,
  voteWeightLoading,
  upvoteLoading,
  upvoteSuccess,
  onClose,
  onConfirm,
  onVoteWeightChange,
  votingPower,
  colors,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 24,
            margin: 20,
            width: '90%',
            maxWidth: 400,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 12,
            }}
          >
            Upvote Snap
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>
              Vote Weight: {voteWeight}%
            </Text>
            {votingPower !== null && votingPower !== undefined && (
              <Text style={{ color: colors.text, fontSize: 15, opacity: 0.7 }}>
                VP: {formatVotingPower(votingPower)}%
              </Text>
            )}
          </View>

          {voteWeightLoading ? (
            <ActivityIndicator
              size='small'
              color={colors.button}
              style={{ marginVertical: 16 }}
            />
          ) : (
            <>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={voteWeight}
                onValueChange={onVoteWeightChange}
                minimumTrackTintColor={colors.button}
                maximumTrackTintColor={colors.buttonInactive}
                thumbTintColor={colors.button}
              />
              {voteValue !== null && (
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: 'bold',
                    marginTop: 12,
                  }}
                >
                  ${voteValue.usd} USD
                </Text>
              )}
            </>
          )}

          {upvoteLoading ? (
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <FontAwesome
                name='hourglass-half'
                size={32}
                color={colors.icon}
              />
              <Text style={{ color: colors.text, marginTop: 8 }}>
                Submitting vote...
              </Text>
            </View>
          ) : upvoteSuccess ? (
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <FontAwesome
                name='check-circle'
                size={32}
                color={colors.button}
              />
              <Text style={{ color: colors.text, marginTop: 8 }}>
                Upvote successful!
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', marginTop: 24 }}>
              <Pressable
                style={{
                  flex: 1,
                  marginRight: 8,
                  backgroundColor: colors.buttonInactive,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
                onPress={onClose}
                disabled={upvoteLoading}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  marginLeft: 8,
                  backgroundColor: colors.button,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
                onPress={onConfirm}
                disabled={upvoteLoading}
              >
                <Text style={{ color: colors.buttonText, fontWeight: '600' }}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default UpvoteModal;
