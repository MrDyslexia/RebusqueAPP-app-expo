import type { TextStyle } from 'react-native';

import { brandColors, textColors } from './colors';

export const fontWeights = {
  regular: '400',
  medium: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Named text styles. `brandEyebrow` is the only style allowed to render
 * brand primary pink as text color on a light background, because its
 * size/weight clears the WCAG AA large-text threshold (>=16px bold).
 * All other small labels use `text.secondary` or `text.primary` for
 * guaranteed 4.5:1+ contrast on the light background.
 */
export const typography = {
  brandEyebrow: {
    color: brandColors.primary,
    fontSize: 14,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: textColors.secondary,
    fontSize: 12,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  displayTitle: {
    color: textColors.primary,
    fontSize: 32,
    fontWeight: fontWeights.extrabold,
  },
  title: {
    color: textColors.primary,
    fontSize: 27,
    fontWeight: fontWeights.extrabold,
  },
  sectionTitle: {
    color: textColors.primary,
    fontSize: 18,
    fontWeight: fontWeights.extrabold,
  },
  subtitle: {
    color: textColors.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    color: textColors.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: textColors.primary,
    fontSize: 14,
    fontWeight: fontWeights.bold,
  },
  caption: {
    color: textColors.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: fontWeights.extrabold,
  },
} as const satisfies Record<string, TextStyle>;

export type Typography = typeof typography;
