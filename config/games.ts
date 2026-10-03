import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type { FontAwesome } from '@expo/vector-icons';

export type GamePlatform = 'ios' | 'android';

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  icon: ComponentProps<typeof FontAwesome>['name'];
  route: string;
  /** Platforms with a working native implementation. */
  platforms: GamePlatform[];
}

/** Add new games here, plus a route under app/screens/games/. */
export const GAMES: GameDefinition[] = [
  {
    id: 'cuarenta',
    title: '40',
    description: 'Cuarenta, the classic Ecuadorian card game.',
    icon: 'gamepad',
    route: '/screens/games/CuarentaScreen',
    platforms: ['ios'],
  },
];

export const isGameAvailable = (game: GameDefinition): boolean =>
  (game.platforms as string[]).includes(Platform.OS);

export const hasAvailableGames = (): boolean => GAMES.some(isGameAvailable);
