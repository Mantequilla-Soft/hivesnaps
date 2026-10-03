import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTheme } from '../../constants/Colors';
import { useColorScheme } from '../../components/useColorScheme';
import { GAMES, isGameAvailable, type GameDefinition } from '../../config/games';

export default function GamesHubScreen() {
  const colorScheme = useColorScheme() || 'light';
  const theme = getTheme(colorScheme);
  const router = useRouter();

  const goBack = () => {
    router.canGoBack() ? router.back() : router.replace('/screens/FeedScreen');
  };

  const renderGame = ({ item }: { item: GameDefinition }) => {
    const available = isGameAvailable(item);
    return (
      <TouchableOpacity
        disabled={!available}
        onPress={() => router.push(item.route as any)}
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: available ? 1 : 0.5 },
        ]}
        accessibilityRole='button'
        accessibilityLabel={`Play ${item.title}`}
        accessibilityState={{ disabled: !available }}
      >
        <FontAwesome name={item.icon} size={28} color={theme.icon} />
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
            {available ? item.description : 'Not available on this platform yet.'}
          </Text>
        </View>
        {available && <FontAwesome name='chevron-right' size={14} color={theme.textSecondary} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel='Go back'
          accessibilityRole='button'
        >
          <FontAwesome name='arrow-left' size={20} color={theme.icon} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Games</Text>
      </View>
      <FlatList
        data={GAMES}
        keyExtractor={(g) => g.id}
        renderItem={renderGame}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginLeft: 16 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardText: { flex: 1, marginHorizontal: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDesc: { fontSize: 14, marginTop: 2 },
});
