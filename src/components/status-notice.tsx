import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Banner, Text } from 'react-native-paper';

import { theme } from '@/theme';

export type StatusNoticeVariant = 'info' | 'success' | 'warning' | 'danger';

interface StatusNoticeProps {
  children: ReactNode;
  icon?: (props: { size: number }) => ReactNode;
  variant: StatusNoticeVariant;
}

/**
 * Shared semantic notice (info/success/warning/danger) built on top of
 * react-native-paper's `Banner`, which has no built-in semantic color
 * variants of its own. Reads background/border/text colors from
 * `theme.colors.status.*` — the same tokens every screen already used
 * before the Paper migration — so all screens render one consistent notice
 * style per variant instead of re-implementing the color override each
 * time. Always visible (persistent, non-dismissible), matching how these
 * notices were used before this component existed.
 */
export function StatusNotice({ children, icon, variant }: StatusNoticeProps) {
  const palette = theme.colors.status[variant];

  return (
    <Banner icon={icon} style={[styles.banner, { backgroundColor: palette.background, borderColor: palette.border }]} visible>
      <Text style={{ color: palette.text }}>{children}</Text>
    </Banner>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: theme.radii.md, borderWidth: 1, overflow: 'hidden' },
});
