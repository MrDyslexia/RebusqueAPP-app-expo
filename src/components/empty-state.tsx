import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Surface } from 'react-native-paper';

import { theme } from '@/theme';

interface EmptyStateProps {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <Surface elevation={2} style={styles.container}>
      <Avatar.Icon icon={() => icon} size={48} style={styles.iconContainer} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    gap: theme.spacing.sm + 2,
    padding: theme.spacing.xl,
  },
  iconContainer: {
    backgroundColor: theme.colors.primarySoft,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  action: {
    marginTop: 6,
  },
});
