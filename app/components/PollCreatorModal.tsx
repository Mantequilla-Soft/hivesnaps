import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { PollDraft } from '../../utils/pollDetection';

export type { PollDraft };

interface PollCreatorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (poll: PollDraft) => void;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    inputBg: string;
    inputBorder: string;
    button: string;
    buttonText: string;
    buttonInactive: string;
    error: string;
    warning: string;
  };
}

const DURATION_OPTIONS = [1, 3, 7, 14];

export const PollCreatorModal: React.FC<PollCreatorModalProps> = ({
  visible,
  onClose,
  onConfirm,
  colors,
}) => {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState(['', '']);
  const [durationDays, setDurationDays] = useState(7);
  const [maxChoicesVoted, setMaxChoicesVoted] = useState(1);
  const [allowVoteChanges, setAllowVoteChanges] = useState(false);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const reset = () => {
    setQuestion('');
    setChoices(['', '']);
    setDurationDays(7);
    setMaxChoicesVoted(1);
    setAllowVoteChanges(false);
    setHideResultsUntilVoted(false);
    setValidationError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addChoice = () => {
    if (choices.length < 5) {
      setChoices((prev) => [...prev, '']);
    }
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) return;
    const next = choices.filter((_, i) => i !== index);
    setChoices(next);
    if (maxChoicesVoted > next.length) setMaxChoicesVoted(next.length);
  };

  const updateChoice = (index: number, value: string) => {
    setChoices((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const validate = (): boolean => {
    if (!question.trim()) {
      setValidationError('Please enter a poll question.');
      return false;
    }
    const filled = choices.filter((c) => c.trim());
    if (filled.length < 2) {
      setValidationError('Please enter at least 2 choices.');
      return false;
    }
    const unique = new Set(filled.map((c) => c.trim().toLowerCase()));
    if (unique.size !== filled.length) {
      setValidationError('Choices must be unique.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    const filledChoices = choices.filter((c) => c.trim());
    onConfirm({
      question: question.trim(),
      choices: filledChoices,
      durationDays,
      maxChoicesVoted: Math.min(maxChoicesVoted, filledChoices.length),
      allowVoteChanges,
      hideResultsUntilVoted,
    });
    reset();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.inputBorder }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Create Poll</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome name="times" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {/* Question */}
            <Text style={[styles.label, { color: colors.text }]}>Question</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask a question..."
              placeholderTextColor={colors.textSecondary}
              maxLength={160}
            />

            {/* Choices */}
            <Text style={[styles.label, { color: colors.text }]}>Choices</Text>
            {choices.map((choice, index) => (
              <View key={index} style={styles.choiceRow}>
                <TextInput
                  style={[styles.choiceInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
                  value={choice}
                  onChangeText={(val) => updateChoice(index, val)}
                  placeholder={`Choice ${index + 1}`}
                  placeholderTextColor={colors.textSecondary}
                  maxLength={80}
                />
                {choices.length > 2 && (
                  <TouchableOpacity
                    onPress={() => removeChoice(index)}
                    style={styles.removeChoiceBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <FontAwesome name="minus-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {choices.length < 5 && (
              <TouchableOpacity
                style={[styles.addChoiceBtn, { borderColor: colors.button }]}
                onPress={addChoice}
              >
                <FontAwesome name="plus" size={14} color={colors.button} />
                <Text style={[styles.addChoiceText, { color: colors.button }]}>Add choice</Text>
              </TouchableOpacity>
            )}

            {/* Duration */}
            <Text style={[styles.label, { color: colors.text }]}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.durationBtn,
                    {
                      backgroundColor: durationDays === d ? colors.button : colors.inputBg,
                      borderColor: durationDays === d ? colors.button : colors.inputBorder,
                    },
                  ]}
                  onPress={() => setDurationDays(d)}
                >
                  <Text
                    style={[
                      styles.durationBtnText,
                      { color: durationDays === d ? colors.buttonText : colors.text },
                    ]}
                  >
                    {d}d
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Max choices voted */}
            {choices.filter((c) => c.trim()).length > 1 && (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Max selections per voter</Text>
                <View style={styles.durationRow}>
                  {Array.from({ length: choices.filter((c) => c.trim()).length }, (_, i) => i + 1).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.durationBtn,
                        {
                          backgroundColor: maxChoicesVoted === n ? colors.button : colors.inputBg,
                          borderColor: maxChoicesVoted === n ? colors.button : colors.inputBorder,
                        },
                      ]}
                      onPress={() => setMaxChoicesVoted(n)}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          { color: maxChoicesVoted === n ? colors.buttonText : colors.text },
                        ]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Allow vote changes</Text>
              <Switch
                value={allowVoteChanges}
                onValueChange={setAllowVoteChanges}
                trackColor={{ true: colors.button, false: colors.inputBorder }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Hide results until voted</Text>
              <Switch
                value={hideResultsUntilVoted}
                onValueChange={setHideResultsUntilVoted}
                trackColor={{ true: colors.button, false: colors.inputBorder }}
                thumbColor="#fff"
              />
            </View>

            {validationError && (
              <Text style={[styles.errorText, { color: colors.error }]}>{validationError}</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.button }]}
            onPress={handleConfirm}
          >
            <Text style={[styles.confirmBtnText, { color: colors.buttonText }]}>Add Poll</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  choiceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  removeChoiceBtn: {
    padding: 4,
  },
  addChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addChoiceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  durationBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  toggleLabel: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    marginTop: 12,
  },
  confirmBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
