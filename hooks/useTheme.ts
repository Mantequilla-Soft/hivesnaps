/**
 * useTheme Hook
 * 
 * Provides access to the current theme colors based on the device's color scheme.
 * Use this hook in components and screens instead of hardcoding colors.
 * 
 * @example
 * const theme = useTheme();
 * <View style={{ backgroundColor: theme.background }}>
 *   <Text style={{ color: theme.text }}>Hello</Text>
 * </View>
 */

import { useColorScheme } from 'react-native';
import { Theme, themes, ThemeMode, getTheme } from '../constants/Colors';

export interface UseThemeResult extends Theme {
    /** Current theme mode: 'light' or 'dark' */
    mode: ThemeMode;
    /** Whether dark mode is active */
    isDark: boolean;
}

/**
 * Hook to get the current theme colors based on system color scheme.
 * 
 * @returns Theme object with all color values plus mode and isDark helpers
 */
export function useTheme(): UseThemeResult {
    const colorScheme = useColorScheme();
    const mode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';
    const theme = getTheme(mode);

    return {
        ...theme,
        mode,
        isDark: mode === 'dark',
    };
}

/**
 * Get theme colors for a specific mode (useful in style factories).
 * 
 * @param isDark - Whether to return dark theme colors
 * @returns Theme object with all color values
 */
export function getThemeColors(isDark: boolean): Theme {
    return isDark ? themes.dark : themes.light;
}

export type { Theme, ThemeMode };
