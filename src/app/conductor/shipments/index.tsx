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

const Package = require('lucide-react-native/dist/cjs/icons/package.js') as typeof import('lucide-react-native/dist/types/icons/package').default;

export default function ShipmentInboxScreen() {
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
          error instanceof Error ? error.message : 'No se pudo sincronizar la lista de encomiendas con el servidor. Verifica tu conexión e inténtalo de nuevo.',
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mis encomiendas</Text>
          <Text style={styles.caption}>El backend filtra automáticamente por tu conductor asignado.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
        ) : loadFailed ? (
          <EmptyState
            description={loadErrorMessage ?? 'No se pudo sincronizar la lista de encomiendas con el servidor. Verifica tu conexión e inténtalo de nuevo.'}
            icon={<Package color={theme.colors.primary} size={24} />}
            title="No se pudieron cargar las encomiendas"
          />
        ) : shipments.length === 0 ? (
          <EmptyState
            description="No tienes encomiendas asignadas en este momento. Vuelve a revisar más tarde."
            icon={<Package color={theme.colors.primary} size={24} />}
            title="Sin encomiendas asignadas"
          />
        ) : (
          shipments.map((shipment) => (
            <Link key={shipment.id} href={{ pathname: '/conductor/[shipmentId]', params: { shipmentId: shipment.id } }} asChild>
              <Pressable accessibilityLabel={`Abrir encomienda ${shipment.reference}`} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.reference}>{shipment.reference}</Text>
                  <ShipmentStatusChip status={shipment.status} />
                </View>
                <Text style={styles.recipient}>{shipment.recipientName}</Text>
                <Text style={styles.location}>{shipment.deliveryAddress}</Text>
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
  recipient: { color: theme.colors.text.primary, fontSize: 18, fontWeight: '800' },
  location: { color: theme.colors.text.secondary, fontSize: 15 },
});
