import { StyleSheet, Text } from 'react-native';

import { StatusNotice } from '@/components/status-notice';
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
    <StatusNotice variant="info">
      <Text style={styles.title}>Actualizaciones en vivo</Text>
      {'\n'}
      <Text style={styles.message}>{getStatusText(connection)}</Text>
      {'\n'}
      {latestEvent ? (
        <Text style={styles.observation}>
          Último evento recibido a las {new Date(latestEvent.receivedAt).toLocaleTimeString()}.
        </Text>
      ) : (
        <Text style={styles.observation}>Aún no se ha recibido ningún evento en vivo.</Text>
      )}
    </StatusNotice>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  observation: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
