import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

/**
 * Craft Mastery Mobile Design Tokens
 * Strictly calibrated for Expo React Native on physical iOS and Android devices.
 * Enforces native touch minimums, accessible contrasts, and culturally rooted aesthetics.
 */

 export const PALETTE = {
  // White, cream and earthy brown craft palette.
  primary: '#6B4226',
  primaryDark: '#3E2618',
  primaryLight: '#A67C52',
  primaryMuted: 'rgba(107, 66, 38, 0.12)',
  primaryPressed: '#4F301D',

  // Clean warm-white surfaces keep handmade craft imagery prominent.
  background: '#FFFDF9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFCF7',
  surfaceHighlight: '#F5EDE4',
  surfaceBorder: '#E6D8C8',
  borderActive: '#6B4226',
  inputBg: '#FFFCF7',
  scrim: 'rgba(62, 38, 24, 0.55)',

  // Warm brown typography.
  textPrimary: '#3E2618',
  textSecondary: '#6F5A49',
  textMuted: '#8A7665',
  textInverse: '#FFFFFF',

  // Status Colors
  success: '#3F7D5A',
  successMuted: 'rgba(63, 125, 90, 0.15)',
  error: '#B94A48',
  errorMuted: 'rgba(185, 74, 72, 0.15)',
  warning: '#A67C52',
  warningMuted: 'rgba(166, 124, 82, 0.15)',
  info: '#6F7F78',
  infoMuted: 'rgba(111, 127, 120, 0.15)',

  // Loading / Skeleton States
  skeletonBase: '#EDE3D8',
  skeletonHighlight: '#F8F3ED',

  // AI accent - muted earthy brown.
  aiAccent: '#78604A',
  aiAccentMuted: 'rgba(120, 96, 74, 0.14)',
} as const;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Touch target minimums strictly enforced per platform guidelines:
 * iOS: 44×44 pt minimum
 * Android: 48×48 dp minimum
 */
export const TOUCH_TARGET = {
  minWidth: Platform.OS === 'ios' ? 44 : 48,
  minHeight: Platform.OS === 'ios' ? 44 : 48,
  padding: Platform.OS === 'ios' ? SPACING.sm : SPACING.md,
} as const;

/**
 * Native Typography Hierarchy
 * Uses system fonts (San Francisco on iOS, Roboto on Android) with appropriate line heights
 */
export const TYPOGRAPHY: Record<string, TextStyle> = {
  displayHero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: PALETTE.textPrimary,
    letterSpacing: 0.1,
  },
  display: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    color: PALETTE.textPrimary,
  },
  statNumber: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: PALETTE.primary,
  },
  title1: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    color: PALETTE.textPrimary,
  },
  title2: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: PALETTE.textPrimary,
  },
  headline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: PALETTE.textPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: PALETTE.textSecondary,
  },
  callout: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: PALETTE.textSecondary,
  },
  subhead: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: PALETTE.textMuted,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: PALETTE.textMuted,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: PALETTE.textMuted,
    letterSpacing: 0.2,
  },
};

/**
 * Elevation & Shadow Scale
 * Android: elevation. iOS: soft layered shadows. Used by cards, sheets, and floating elements.
 */
export const ELEVATION = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
  }),
  fab: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
    },
    android: {
      elevation: 6,
    },
  }),
} as const;

/**
 * Reusable Mobile Component Styles & Interactions
 */
export const COMPONENT_STYLES = StyleSheet.create({
  // Safe container
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  // Card base with tactile border
  card: {
    backgroundColor: PALETTE.surface,
    borderColor: PALETTE.surfaceBorder,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  // Primary Action Button (Meeting 48dp / 44pt touch minimums)
  primaryButton: {
    minHeight: TOUCH_TARGET.minHeight,
    backgroundColor: PALETTE.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: PALETTE.textInverse,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Secondary Button
  secondaryButton: {
    minHeight: TOUCH_TARGET.minHeight,
    backgroundColor: PALETTE.surface,
    borderColor: PALETTE.surfaceBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: PALETTE.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * Tactile touch feedback options for Pressable components
 */
export const PRESSABLE_CONFIG = {
  activeOpacity: 0.7,
  androidRipple: {
    color: 'rgba(184, 92, 56, 0.18)',
    borderless: false,
  },
};
