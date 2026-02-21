/**
 * Centralized Color System for HiveSnaps
 * 
 * This file defines all colors used throughout the app.
 * DO NOT use hardcoded colors in components - import from here.
 */

// ============================================================================
// BASE COLORS - Raw color values (not for direct use in components)
// ============================================================================
export const palette = {
  // Brand Colors
  primary: '#1DA1F2',
  primaryDark: '#1A8CD8',

  // Status Colors
  success: '#17BF63',
  successAlt: '#51CF66',
  warning: '#F39C12',
  warningLight: '#FF6B6B',
  error: '#E74C3C',
  errorLight: '#FF6B6B',

  // Neutrals - Light Mode
  white: '#FFFFFF',
  lightBackground: '#FFFFFF',
  lightBackgroundHighlight: '#F0F8FF',
  lightBubble: '#F7F9F9',
  lightBorder: '#E1E8ED',
  lightBorderAlt: '#CFD9DE',
  lightBorderSubtle: '#EEEEEE',
  lightText: '#0F1419',
  lightTextSecondary: '#536471',
  lightPlaceholder: '#94A3B8',
  lightInactive: '#E1E8ED',
  lightTabIcon: '#CCCCCC',

  // Neutrals - Dark Mode
  darkBackground: '#15202B',
  darkBubble: '#22303C',
  darkBubbleHighlight: '#1C2938',
  darkBorder: '#38444D',
  darkText: '#D7DBDC',
  darkTextSecondary: '#8899A6',
  darkPlaceholder: '#8899A6',
  darkInactive: '#22303C',

  // Overlays & Shadows
  overlayLight: 'rgba(0, 0, 0, 0.4)',
  overlayMedium: 'rgba(0, 0, 0, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
  overlayFull: 'rgba(0, 0, 0, 0.95)',
  shadow: '#000000',

  // Special Purpose
  gold: '#FFD700',
  unfollowButton: '#8B9DC3',
  transparent: 'transparent',
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Convert a hex color to rgba format with opacity.
 * @param hex - Hex color (e.g., '#1DA1F2')
 * @param opacity - Opacity value 0-1 (e.g., 0.1 for 10%)
 * @returns RGBA string (e.g., 'rgba(29, 161, 242, 0.1)')
 */
export const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// ============================================================================
// THEME TYPE DEFINITION
// ============================================================================
export interface Theme {
  // Core
  background: string;
  text: string;
  textSecondary: string;

  // Interactive Elements
  tint: string;
  icon: string;
  button: string;
  buttonText: string;
  buttonInactive: string;
  buttonSecondary: string;
  buttonSecondaryText: string;

  // Surfaces & Containers
  bubble: string;
  card: string;

  // Borders
  border: string;
  borderSubtle: string;
  inputBorder: string;

  // Status
  success: string;
  warning: string;
  error: string;
  payout: string;

  // Text Variants
  placeholderText: string;

  // Navigation
  tabIconDefault: string;
  tabIconSelected: string;

  // Modal/TOS specific
  tosBackground: string;
  tosText: string;

  // Action Buttons
  followButton: string;
  unfollowButton: string;
  mutedButton: string;

  // Overlays
  overlay: string;
  overlayDark: string;
}

// ============================================================================
// LIGHT THEME
// ============================================================================
export const lightTheme: Theme = {
  // Core
  background: palette.lightBackground,
  text: palette.lightText,
  textSecondary: palette.lightTextSecondary,

  // Interactive Elements
  tint: palette.primary,
  icon: palette.primary,
  button: palette.primary,
  buttonText: palette.white,
  buttonInactive: palette.lightInactive,
  buttonSecondary: palette.lightBorder,
  buttonSecondaryText: palette.lightText,

  // Surfaces & Containers
  bubble: palette.lightBubble,
  card: palette.lightBubble,

  // Borders
  border: palette.lightBorder,
  borderSubtle: palette.lightBorderSubtle,
  inputBorder: palette.lightBorderAlt,

  // Status
  success: palette.success,
  warning: palette.warningLight,
  error: palette.error,
  payout: palette.success,

  // Text Variants
  placeholderText: palette.lightPlaceholder,

  // Navigation
  tabIconDefault: palette.lightTabIcon,
  tabIconSelected: palette.primary,

  // Modal/TOS specific
  tosBackground: palette.white,
  tosText: palette.lightText,

  // Action Buttons
  followButton: palette.primary,
  unfollowButton: palette.unfollowButton,
  mutedButton: palette.error,

  // Overlays
  overlay: palette.overlayLight,
  overlayDark: palette.overlayDark,
};

// ============================================================================
// DARK THEME
// ============================================================================
export const darkTheme: Theme = {
  // Core
  background: palette.darkBackground,
  text: palette.darkText,
  textSecondary: palette.darkTextSecondary,

  // Interactive Elements
  tint: palette.white,
  icon: palette.primary,
  button: palette.primary,
  buttonText: palette.white,
  buttonInactive: palette.darkInactive,
  buttonSecondary: palette.darkBubble,
  buttonSecondaryText: palette.darkText,

  // Surfaces & Containers
  bubble: palette.darkBubble,
  card: palette.darkBubble,

  // Borders
  border: palette.darkBorder,
  borderSubtle: palette.darkBorder,
  inputBorder: palette.darkBorder,

  // Status
  success: palette.success,
  warning: palette.warningLight,
  error: palette.error,
  payout: palette.success,

  // Text Variants
  placeholderText: palette.darkPlaceholder,

  // Navigation
  tabIconDefault: palette.lightTabIcon,
  tabIconSelected: palette.white,

  // Modal/TOS specific
  tosBackground: palette.darkBackground,
  tosText: palette.darkText,

  // Action Buttons
  followButton: palette.primary,
  unfollowButton: palette.unfollowButton,
  mutedButton: palette.error,

  // Overlays
  overlay: palette.overlayLight,
  overlayDark: palette.overlayDark,
};

// ============================================================================
// THEME HELPERS
// ============================================================================
export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export type ThemeMode = keyof typeof themes;

export function getTheme(mode: ThemeMode): Theme {
  return themes[mode];
}

// ============================================================================
// LEGACY EXPORT (for backward compatibility)
// ============================================================================
const Colors = {
  light: {
    text: lightTheme.text,
    background: lightTheme.background,
    tint: lightTheme.tint,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: lightTheme.tabIconSelected,
    tosBackground: lightTheme.tosBackground,
    tosText: lightTheme.tosText,
    primaryButton: lightTheme.button,
    primaryButtonText: lightTheme.buttonText,
    secondaryButton: lightTheme.buttonSecondary,
    secondaryButtonText: lightTheme.buttonSecondaryText,
    border: lightTheme.border,
    warning: lightTheme.warning,
    success: lightTheme.success,
  },
  dark: {
    text: darkTheme.text,
    background: darkTheme.background,
    tint: darkTheme.tint,
    tabIconDefault: darkTheme.tabIconDefault,
    tabIconSelected: darkTheme.tabIconSelected,
    tosBackground: darkTheme.tosBackground,
    tosText: darkTheme.tosText,
    primaryButton: darkTheme.button,
    primaryButtonText: darkTheme.buttonText,
    secondaryButton: darkTheme.buttonSecondary,
    secondaryButtonText: darkTheme.buttonSecondaryText,
    border: darkTheme.border,
    warning: darkTheme.warning,
    success: darkTheme.success,
  },
};

export default Colors;
