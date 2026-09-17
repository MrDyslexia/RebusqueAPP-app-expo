import { Platform } from 'react-native';

import { brandColors } from './colors';

/**
 * Subtle elevation presets used for cards and pressed states.
 */
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: brandColors.secondary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: { elevation: 3 },
    default: {},
  }),
  cardPressed: Platform.select({
    ios: {
      shadowColor: brandColors.secondary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  }),
  none: Platform.select({
    ios: { shadowOpacity: 0 },
    android: { elevation: 0 },
    default: {},
  }),
} as const;

export type Shadows = typeof shadows;
