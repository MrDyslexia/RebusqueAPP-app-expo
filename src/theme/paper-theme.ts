import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { colors } from './colors';

/**
 * Maps the RebusqueAPP brand palette (`colors.ts`, verified 1:1 against
 * elrebusque.cl's real CSS) onto react-native-paper's MD3 color roles.
 *
 * This is the single source of truth Paper components (`Button`, `Chip`,
 * `TextInput`, `Menu`, etc.) read colors from via `PaperProvider`. Screens
 * keep using the plain `theme` object (see `theme/index.ts`) for
 * spacing/radii/shadows/typography, which Paper's theme does not model —
 * both theme systems coexist deliberately instead of forcing every custom
 * token into Paper's shape.
 *
 * `roundness` is intentionally left at Paper's default: pill-shaped
 * primary/secondary buttons keep using `theme.radii.pill` as an explicit
 * per-component `style` override (see the migration screens) instead of a
 * global high `roundness`, which would also distort inputs and cards.
 */
export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.text.onPrimary,
    primaryContainer: colors.primarySoft,
    onPrimaryContainer: colors.secondary,
    secondary: colors.secondary,
    onSecondary: colors.text.onSecondary,
    secondaryContainer: colors.surfaceMuted,
    onSecondaryContainer: colors.secondary,
    background: colors.background,
    onBackground: colors.text.primary,
    surface: colors.surface,
    onSurface: colors.text.primary,
    surfaceVariant: colors.surfaceMuted,
    onSurfaceVariant: colors.text.secondary,
    outline: colors.border,
    outlineVariant: colors.border,
    error: colors.status.danger.text,
    errorContainer: colors.status.danger.background,
    onError: colors.text.onPrimary,
    onErrorContainer: colors.status.danger.text,
  },
};
