/**
 * RebusqueAPP brand color tokens.
 *
 * Source palette verified against elrebusque.cl:
 * - Primary: #FF0066 (pressed/hover: #E6005C)
 * - Secondary/dark: #0A0A3E (variants #1A1A5E, #0D0D4A)
 * - Light background: #F7F7FC
 *
 * Contrast notes (WCAG 2.1 relative luminance, verified 2026-09-15):
 * - White (#FFFFFF) on primary (#FF0066): ~3.86:1.
 *   Meets AA for large text (>=18.66px bold or >=24px regular) and for
 *   non-text UI component contrast (3:1). Does NOT meet AA 4.5:1 for
 *   small body text. Primary buttons therefore use bold, >=16px labels
 *   and reserve #FF0066 fills for buttons/icons/tags, never small body
 *   copy on a light background.
 * - White (#FFFFFF) on secondary (#0A0A3E): ~18.6:1. Passes AAA at any size.
 * - Secondary (#0A0A3E) on light background (#F7F7FC): ~17.9:1. Passes AAA.
 * - Primary (#FF0066) on light background (#F7F7FC) as text: ~3.6:1.
 *   Reserved for large/bold brand marks (>=16px bold) or non-text
 *   accents (icons, borders). Small labels use text.secondary instead.
 */

export const brandColors = {
  primary: '#FF0066',
  primaryPressed: '#E6005C',
  primarySoft: '#FFE1EC',
  secondary: '#0A0A3E',
  secondaryLight: '#1A1A5E',
  secondaryDeep: '#0D0D4A',
} as const;

export const neutralColors = {
  background: '#F7F7FC',
  surface: '#FFFFFF',
  surfacePressed: '#FDF1F6',
  surfaceMuted: '#EFEFF7',
  border: '#E4E4F1',
  borderStrong: '#C9C9E2',
} as const;

export const textColors = {
  primary: '#14142B',
  secondary: '#52526B',
  muted: '#7C7C97',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onDark: '#EDEDFB',
  accent: brandColors.primary,
} as const;

export const statusColors = {
  neutral: { background: '#EEF0F6', border: '#D7D9E8', text: '#4A4A63' },
  info: { background: '#ECEAF9', border: '#C6C2EF', text: brandColors.secondary },
  success: { background: '#E1F4EA', border: '#A9DFC1', text: '#1C7A4C' },
  warning: { background: '#FFF3D6', border: '#F2C66D', text: '#8A5A00' },
  danger: { background: '#FDE1EA', border: '#F5B7CB', text: '#B0123F' },
  violet: { background: '#F1E9FB', border: '#D6C2F0', text: '#6B3FA0' },
} as const;

/**
 * Semi-transparent overlay tokens. `scannerBackdrop` is `secondary`
 * (#0A0A3E) at 88% opacity, used behind in-camera UI (e.g. the QR scanner's
 * result panel) so the live camera feed stays dimmed but visible.
 */
export const overlayColors = {
  scannerBackdrop: 'rgba(10, 10, 62, 0.88)',
} as const;

export const colors = {
  ...brandColors,
  ...neutralColors,
  text: textColors,
  status: statusColors,
  overlay: overlayColors,
} as const;

export type Colors = typeof colors;
