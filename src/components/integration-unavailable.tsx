import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

export function IntegrationUnavailable({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Integración pendiente</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.status.warning.background,
    borderColor: theme.colors.status.warning.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    margin: theme.spacing.lg,
    padding: theme.spacing.base,
    gap: theme.spacing.xs + 2,
  },
  title: {
    color: theme.colors.status.warning.text,
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    color: theme.colors.status.warning.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
