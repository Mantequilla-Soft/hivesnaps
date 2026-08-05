import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CuarentaView, type GameEvent } from '@mantequilla-soft/cuarenta';
import { getTheme } from '../../constants/Colors';
import { useColorScheme } from '../../components/useColorScheme';

export default function GameScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const router = useRouter();
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);

  const closeGame = () => {
    router.canGoBack() ? router.back() : router.replace('/screens/FeedScreen');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Cuarenta</Text>
      <CuarentaView
        color="#32a852"
        style={styles.game}
        onGameEvent={(e) => setLastEvent(e.nativeEvent)}
      />
      <Text style={[styles.status, { color: theme.text }]}>
        {lastEvent ? `${lastEvent.type}: ${lastEvent.payload}` : 'Tap the game'}
      </Text>
      <TouchableOpacity
        onPress={closeGame}
        style={[styles.closeButton, { backgroundColor: theme.buttonSecondary }]}
        accessibilityLabel='Close game'
        accessibilityRole='button'
      >
        <FontAwesome name='times' size={16} color={theme.buttonSecondaryText} />
        <Text style={[styles.closeButtonText, { color: theme.buttonSecondaryText }]}>
          Close Game
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  game: {
    width: 200,
    height: 200,
  },
  status: {
    marginTop: 16,
  },
});
