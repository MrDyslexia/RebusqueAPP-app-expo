import { StyleSheet, Text, View } from 'react-native';

import { StatusNotice } from '@/components/status-notice';
import { theme } from '@/theme';

export function IntegrationUnavailable({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <StatusNotice variant="warning">
        <Text style={styles.title}>Integración pendiente</Text>
        {'\n'}
        <Text style={styles.message}>{message}</Text>
      </StatusNotice>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: theme.spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
});
