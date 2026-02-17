/**
 * App Colors - Re-exports from centralized theme
 * 
 * @deprecated Import directly from '../../constants/Colors' or use useTheme hook
 * This file is kept for backward compatibility.
 */

import { useColorScheme } from 'react-native';
import { Theme, lightTheme, darkTheme, getTheme, ThemeMode } from '../../constants/Colors';

export type AppColors = Theme;

export const palettes: Record<'light' | 'dark', AppColors> = {
  light: lightTheme,
  dark: darkTheme,
};

export function getAppColorsByScheme(scheme: 'light' | 'dark'): AppColors {
  return getTheme(scheme);
}

export function useAppColors(): AppColors {
  const scheme = useColorScheme() || 'light';
  return getAppColorsByScheme(scheme as ThemeMode);
}

