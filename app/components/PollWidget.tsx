import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { PollMetadata } from '../../utils/pollDetection';
import { usePoll } from '../../hooks/usePoll';

interface PollWidgetProps {
  poll: PollMetadata;
  author: string;
  permlink: string;
  currentUsername: string | null;
  colors: {
    text: string;
    textSecondary: string;
    bubble: string;
    border: string;
    button: string;
    buttonText: string;
    buttonInactive: string;
    payout: string;
  };
}

function formatTimeLeft(endTimeSeconds: number): string {
  const diff = endTimeSeconds * 1000 - Date.now();
  if (diff <= 0) return 'Poll ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export const PollWidget: React.FC<PollWidgetProps> = ({
  poll,
  author,
  permlink,
  currentUsername,
  colors,
}) => {
  const {
    results,
    loading,
    error,
    voted,
    userChoices,
    voting,
    voteError,
    keyInputVisible,
    keyInput,
    setKeyInput,
    vote,
  } = usePoll(author, permlink, currentUsername);

  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const isMultiChoice = poll.max_choices_voted > 1;
  const isExpired = poll.end_time * 1000 <= Date.now();
  const timeLabel = formatTimeLeft(poll.end_time);

  const showResults =
    isExpired ||
    voted ||
    (!poll.ui_hide_res_until_voted && results !== null);

  const totalVotes = results?.total_votes ?? 0;

  const getVotesForChoice = (choiceIndex: number): number => {
    return results?.choices.find((c) => c.choice_num === choiceIndex)?.votes ?? 0;
  };

  const toggleChoice = (index: number) => {
    if (isMultiChoice) {
      setSelectedChoices((prev) =>
        prev.includes(index)
          ? prev.filter((c) => c !== index)
          : prev.length < poll.max_choices_voted
          ? [...prev, index]
          : prev
      );
    } else {
      setSelectedChoices([index]);
    }
  };

  const handleVote = async () => {
    if (keyInputVisible) {
      await vote([]);
    } else if (selectedChoices.length > 0) {
      await vote(selectedChoices);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
      {/* Question */}
      <Text style={[styles.question, { color: colors.text }]}>{poll.question}</Text>

      {/* Time label */}
      <Text style={[styles.timeLabel, { color: isExpired ? colors.textSecondary : colors.payout }]}>
        {timeLabel}
      </Text>

      {/* Choices */}
      <View style={styles.choices}>
        {poll.choices.map((choice, index) => {
          const votes = getVotesForChoice(index);
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSelected = selectedChoices.includes(index) || userChoices.includes(index);

          if (showResults) {
            return (
              <View key={index} style={[styles.resultRow, { borderColor: colors.border }]}>
                <View
                  style={[
                    styles.resultBar,
                    {
                      width: `${pct}%`,
                      backgroundColor: userChoices.includes(index)
                        ? colors.button + '33'
                        : colors.border,
                    },
                  ]}
                />
                <Text style={[styles.choiceLabel, { color: colors.text }]} numberOfLines={1}>
                  {userChoices.includes(index) ? '✓ ' : ''}{choice}
                </Text>
                <Text style={[styles.pctLabel, { color: colors.textSecondary }]}>
                  {pct}%
                </Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.choiceButton,
                {
                  borderColor: isSelected ? colors.button : colors.border,
                  backgroundColor: isSelected ? colors.button + '22' : 'transparent',
                },
              ]}
              onPress={() => toggleChoice(index)}
              disabled={voting}
            >
              <Text style={[styles.choiceLabel, { color: colors.text }]}>{choice}</Text>
              {isSelected && (
                <Text style={[styles.checkmark, { color: colors.button }]}>✓</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Inline key input */}
      {keyInputVisible && (
        <View style={styles.keySection}>
          <Text style={[styles.keyHint, { color: colors.textSecondary }]}>
            Enter your posting key to vote:
          </Text>
          <TextInput
            style={[styles.keyInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bubble }]}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="5K... posting key"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {/* Errors */}
      {(error || voteError) && (
        <Text style={styles.errorText}>{voteError || error}</Text>
      )}

      {/* Vote button / loading / stats */}
      {loading && !results ? (
        <ActivityIndicator size="small" color={colors.button} style={{ marginTop: 8 }} />
      ) : !isExpired && !voted && currentUsername ? (
        <TouchableOpacity
          style={[
            styles.voteButton,
            {
              backgroundColor:
                (keyInputVisible ? keyInput.trim().length > 0 : selectedChoices.length > 0)
                  ? colors.button
                  : colors.buttonInactive,
            },
          ]}
          onPress={handleVote}
          disabled={
            voting ||
            (keyInputVisible ? keyInput.trim().length === 0 : selectedChoices.length === 0)
          }
        >
          {voting ? (
            <ActivityIndicator size="small" color={colors.buttonText} />
          ) : (
            <Text style={[styles.voteButtonText, { color: colors.buttonText }]}>
              {keyInputVisible ? 'Submit Vote' : 'Vote'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* Vote count */}
      {totalVotes > 0 && (
        <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
          {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 21,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 12,
  },
  choices: {
    gap: 8,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceLabel: {
    fontSize: 14,
    flex: 1,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  resultRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 40,
  },
  resultBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 7,
  },
  pctLabel: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  keySection: {
    marginTop: 10,
    gap: 6,
  },
  keyHint: {
    fontSize: 12,
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 8,
  },
  voteButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  voteCount: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
});
