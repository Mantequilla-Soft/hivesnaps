import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalParticipant } from '@livekit/react-native';
import { FontAwesome } from '@expo/vector-icons';

interface ChatMessage {
  id: string;
  identity: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  visible: boolean;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  colors: {
    text: string;
    textSecondary: string;
    card: string;
    border: string;
    button: string;
    buttonText: string;
    background: string;
  };
}

export default function ChatPanel({ visible, messages, onSend, onClose, colors }: ChatPanelProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (visible && messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, visible]);

  const handleSend = (): void => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  };

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
        <Pressable onPress={onClose} accessibilityRole='button' accessibilityLabel='Close chat'
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesome name='times' size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isMe = item.identity === localParticipant?.identity;
          return (
            <View style={[styles.bubble, isMe && styles.bubbleMe]}>
              {!isMe && (
                <Text style={[styles.bubbleAuthor, { color: colors.button }]}>@{item.identity}</Text>
              )}
              <Text style={[styles.bubbleText, { color: colors.text }]}>{item.text}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet</Text>
        }
      />

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder='Say something...'
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSend}
          returnKeyType='send'
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: colors.button, opacity: draft.trim() ? 1 : 0.4 }]}
          onPress={handleSend}
          disabled={!draft.trim()}
          accessibilityRole='button'
          accessibilityLabel='Send message'
        >
          <FontAwesome name='send' size={14} color={colors.buttonText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: '50%',
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  bubbleMe: { alignSelf: 'flex-end' },
  bubbleAuthor: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  bubbleText: { fontSize: 14 },
  emptyText: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
