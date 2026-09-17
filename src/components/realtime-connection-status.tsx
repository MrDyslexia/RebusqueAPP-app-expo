import { StyleSheet, Text, View } from 'react-native';

import type {
  RealtimeConnectionState,
  RealtimeEventObservation,
} from '@/services/session-websocket';
import { theme } from '@/theme';

interface RealtimeConnectionStatusProps {
  connection: RealtimeConnectionState;
  latestEvent: RealtimeEventObservation | null;
}

function getStatusText(connection: RealtimeConnectionState): string {
  switch (connection.status) {
    case 'connecting':
      return 'Conectando a actualizaciones en vivo…';
    case 'connected':
      return 'Conectado a actualizaciones en vivo.';
    case 'reconnecting':
      return `Reconectando a actualizaciones en vivo (intento ${connection.reconnectAttempt})…`;
    case 'error':
      return 'La conexión de actualizaciones en vivo presentó un error. Se reconectará cuando el socket se cierre.';
    case 'disconnected':
      return 'Las actualizaciones en vivo están desconectadas.';
  }
}

export function RealtimeConnectionStatus({
  connection,
  latestEvent,
}: RealtimeConnectionStatusProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actualizaciones en vivo</Text>
      <Text style={styles.message}>{getStatusText(connection)}</Text>
      {latestEvent ? (
        <Text style={styles.observation}>
          Último evento recibido a las {new Date(latestEvent.receivedAt).toLocaleTimeString()}.
        </Text>
      ) : (
        <Text style={styles.observation}>Aún no se ha recibido ningún evento en vivo.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.status.info.background,
    borderColor: theme.colors.status.info.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs + 2,
    padding: theme.spacing.md + 2,
  },
  title: {
    color: theme.colors.status.info.text,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: theme.colors.status.info.text,
    fontSize: 14,
    lineHeight: 20,
  },
  observation: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
