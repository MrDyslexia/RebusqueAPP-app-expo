import { useCallback, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ShipmentStatusChip } from '@/components/shipment-status-chip';
import type { AssignedShipment } from '@/domain/shipment';
import { useRealtimeShipmentEvents } from '@/hooks/use-realtime-shipment-events';
import { getConductorApi } from '@/services/get-conductor-api';
import { theme } from '@/theme';

const CircleAlert = require('lucide-react-native/dist/cjs/icons/circle-alert.js') as typeof import('lucide-react-native/dist/types/icons/circle-alert').default;

function hasIncident(shipment: AssignedShipment): boolean {
  return shipment.failedAttempts > 0 || shipment.status === 'fallida' || shipment.status === 'finalizada';
}

export default function IncidentHistoryScreen() {
  const [shipments, setShipments] = useState<readonly AssignedShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return getConductorApi()
      .listAssignedShipments()
      .then((result) => {
        setShipments(result);
        setLoadFailed(false);
        setLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        setLoadFailed(true);
        setLoadErrorMessage(
          error instanceof Error ? error.message : 'No se pudo sincronizar el historial de incidentes con el servidor. Verifica tu conexión e inténtalo de nuevo.',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useRealtimeShipmentEvents(useCallback(() => void refetch(), [refetch]));

  const incidentShipments = shipments.filter(hasIncident);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Historial de incidentes</Text>
          <Text style={styles.caption}>
            Esta vista solo cubre las encomiendas asignadas actualmente a tu conductor; no existe todavía un historial de
            incidentes independiente en el backend.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
        ) : loadFailed ? (
          <EmptyState
            description={loadErrorMessage ?? 'No se pudo sincronizar el historial de incidentes con el servidor. Verifica tu conexión e inténtalo de nuevo.'}
            icon={<CircleAlert color={theme.colors.primary} size={24} />}
            title="No se pudo cargar el historial"
          />
        ) : incidentShipments.length === 0 ? (
          <EmptyState
            description="Sin incidentes registrados en tus encomiendas asignadas actuales."
            icon={<CircleAlert color={theme.colors.primary} size={24} />}
            title="Sin incidentes"
          />
        ) : (
          incidentShipments.map((shipment) => (
            <Link key={shipment.id} href={{ pathname: '/conductor/[shipmentId]', params: { shipmentId: shipment.id } }} asChild>
              <Pressable accessibilityLabel={`Abrir encomienda ${shipment.reference}`} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.reference}>{shipment.reference}</Text>
                  <ShipmentStatusChip status={shipment.status} />
                </View>
                <Text style={styles.attempts}>Intentos fallidos: {shipment.failedAttempts}</Text>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.md, padding: theme.spacing.lg },
  header: { gap: theme.spacing.xs + 1, marginBottom: 2 },
  title: { color: theme.colors.text.primary, fontSize: 26, fontWeight: '800' },
  caption: { ...theme.typography.caption, fontSize: 14, lineHeight: 20 },
  loading: { alignItems: 'center', minHeight: 220, justifyContent: 'center' },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    gap: theme.spacing.xs + 2,
    padding: theme.spacing.base,
    ...theme.shadows.card,
  },
  cardPressed: { backgroundColor: theme.colors.surfacePressed, borderColor: theme.colors.primary, ...theme.shadows.cardPressed },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reference: { color: theme.colors.secondary, fontSize: 13, fontWeight: '800' },
  attempts: { color: theme.colors.text.secondary, fontSize: 15, fontWeight: '600' },
});
