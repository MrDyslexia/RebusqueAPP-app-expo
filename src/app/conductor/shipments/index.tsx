import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { ArrowDownAZ, ArrowRight, ArrowUpAZ, Check, ChevronDown, MapPin } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Menu, TextInput } from 'react-native-paper';

import { EmptyState } from '@/components/empty-state';
import { shipmentStatusLabels, ShipmentStatusChip } from '@/components/shipment-status-chip';
import type { AssignedShipment } from '@/domain/shipment';
import { useRealtimeShipmentEvents } from '@/hooks/use-realtime-shipment-events';
import { getConductorApi } from '@/services/get-conductor-api';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';
import {
  filterAndSortShipments,
  getAvailableShipmentStatuses,
  type ShipmentDateOrder,
  type ShipmentStatusFilter,
} from '@/utils/shipment-inbox';

const Package = require('lucide-react-native/dist/cjs/icons/package.js') as typeof import('lucide-react-native/dist/types/icons/package').default;

export default function ShipmentInboxScreen() {
  const [shipments, setShipments] = useState<readonly AssignedShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatusFilter>('all');
  const [dateOrder, setDateOrder] = useState<ShipmentDateOrder>('newest');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  const statusFilters = useMemo<readonly { label: string; value: ShipmentStatusFilter }[]>(
    () => [
      { label: 'Todas', value: 'all' },
      ...getAvailableShipmentStatuses(shipments).map((status) => ({
        label: shipmentStatusLabels[status],
        value: status,
      })),
    ],
    [shipments],
  );
  const activeStatusFilter = statusFilters.some((filter) => filter.value === statusFilter) ? statusFilter : 'all';
  const activeStatusFilterLabel = statusFilters.find((filter) => filter.value === activeStatusFilter)?.label ?? 'Todas';
  const activeDateOrderLabel = dateOrder === 'newest' ? 'Más recientes' : 'Más antiguas';
  const nextDateOrderLabel = dateOrder === 'newest' ? 'Más antiguas' : 'Más recientes';

  const visibleShipments = useMemo(
    () => filterAndSortShipments(shipments, searchTerm, activeStatusFilter, dateOrder),
    [activeStatusFilter, dateOrder, searchTerm, shipments],
  );

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateOrder('newest');
  }, []);

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
          <>
            <View style={styles.controls}>
              <View style={styles.searchField}>
                <Text style={styles.controlLabel}>Buscar por ID</Text>
                <TextInput
                  accessibilityLabel="Buscar encomiendas por ID"
                  autoCapitalize="none"
                  autoCorrect={false}
                  dense
                  keyboardType="default"
                  mode="outlined"
                  onChangeText={setSearchTerm}
                  placeholder="Ejemplo: 9001"
                  value={searchTerm}
                />
              </View>

              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Filtrar</Text>
                <View style={styles.filterRow}>
                  <View style={styles.filterRowFlex}>
                    <Menu
                      anchor={(
                        <Button
                          accessibilityHint="Abre la lista de estados para filtrar."
                          accessibilityLabel={`Filtrar por estado. Estado activo: ${activeStatusFilterLabel}.`}
                          contentStyle={styles.filterButtonContent}
                          icon={paperIcon(ChevronDown)}
                          mode="outlined"
                          onPress={() => setIsStatusMenuOpen(true)}
                          style={styles.statusFilterButton}>
                          {activeStatusFilterLabel}
                        </Button>
                      )}
                      onDismiss={() => setIsStatusMenuOpen(false)}
                      visible={isStatusMenuOpen}>
                      {statusFilters.map((filter) => (
                        <Menu.Item
                          key={filter.value}
                          onPress={() => {
                            setStatusFilter(filter.value);
                            setIsStatusMenuOpen(false);
                          }}
                          title={filter.label}
                          titleStyle={filter.value === activeStatusFilter ? styles.statusMenuOptionSelectedLabel : undefined}
                          trailingIcon={filter.value === activeStatusFilter ? paperIcon(Check) : undefined}
                        />
                      ))}
                    </Menu>
                  </View>

                  <IconButton
                    accessibilityHint={`Activa el orden ${nextDateOrderLabel.toLocaleLowerCase()}.`}
                    accessibilityLabel={`Ordenar por fecha. Orden activo: ${activeDateOrderLabel}.`}
                    icon={paperIcon(dateOrder === 'newest' ? ArrowDownAZ : ArrowUpAZ)}
                    mode="outlined"
                    onPress={() => setDateOrder((currentOrder) => (currentOrder === 'newest' ? 'oldest' : 'newest'))}
                    style={styles.dateOrderButton}
                  />
                </View>
              </View>
            </View>

            {visibleShipments.length === 0 ? (
              <EmptyState
                action={(
                  <Button mode="outlined" onPress={resetFilters} style={styles.resetButton}>
                    Restablecer filtros
                  </Button>
                )}
                description="No hay encomiendas que coincidan con los controles seleccionados."
                icon={<Package color={theme.colors.primary} size={24} />}
                title="Sin coincidencias"
              />
            ) : (
              visibleShipments.map((shipment) => (
                <Link key={shipment.id} href={{ pathname: '/conductor/[shipmentId]', params: { shipmentId: shipment.id } }} asChild>
                  <Pressable accessibilityLabel={`Abrir encomienda ${shipment.reference}`} style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}>
                    <View style={styles.card}>
                      <View style={styles.cardAccent} />
                      <View style={styles.cardHeader}>
                        <View style={styles.referenceGroup}>
                          <Text style={styles.cardEyebrow}>Encomienda</Text>
                          <Text style={styles.reference}>{shipment.reference}</Text>
                        </View>
                        <ShipmentStatusChip status={shipment.status} />
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardEyebrow}>Destinatario</Text>
                        <Text style={styles.recipient}>{shipment.recipientName}</Text>
                        <View style={styles.locationRow}>
                          <MapPin color={theme.colors.text.secondary} size={18} strokeWidth={2.25} />
                          <Text numberOfLines={2} style={styles.location}>{shipment.deliveryAddress}</Text>
                        </View>
                      </View>
                      <View style={styles.cardFooter}>
                        <Text style={styles.detailAction}>Ver detalle</Text>
                        <ArrowRight color={theme.colors.primary} size={18} strokeWidth={2.5} />
                      </View>
                    </View>
                  </Pressable>
                </Link>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.surfaceMuted, flex: 1 },
  content: { gap: theme.spacing.md, padding: theme.spacing.lg },
  loading: { alignItems: 'center', minHeight: 220, justifyContent: 'center' },
  controls: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.base,
    ...theme.shadows.card,
  },
  searchField: { gap: theme.spacing.xs + 2 },
  controlGroup: { gap: theme.spacing.xs + 2 },
  controlLabel: { color: theme.colors.text.secondary, fontSize: 13, fontWeight: '800' },
  filterRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm },
  filterRowFlex: { flex: 1 },
  filterButtonContent: { flexDirection: 'row-reverse' },
  statusFilterButton: { borderRadius: theme.radii.md, width: '100%' },
  dateOrderButton: { borderRadius: theme.radii.md, margin: 0 },
  statusMenuOptionSelectedLabel: { color: theme.colors.primary, fontWeight: '800' },
  cardPressable: { borderRadius: theme.radii.xxl },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    ...theme.shadows.card,
    elevation: 4,
  },
  cardPressed: { opacity: 0.88 },
  cardAccent: { backgroundColor: theme.colors.primary, bottom: 0, left: 0, position: 'absolute', top: 0, width: 5 },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingTop: theme.spacing.base },
  referenceGroup: { gap: 2 },
  cardEyebrow: { color: theme.colors.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  reference: { color: theme.colors.secondary, fontSize: 16, fontWeight: '800' },
  cardBody: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.md },
  recipient: { color: theme.colors.text.primary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  locationRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  location: { color: theme.colors.text.secondary, flex: 1, fontSize: 15, lineHeight: 21 },
  cardFooter: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'flex-end', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm + 2 },
  detailAction: { color: theme.colors.primary, fontSize: 14, fontWeight: '800' },
  resetButton: { borderRadius: theme.radii.pill },
});
