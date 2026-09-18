import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Dialog, IconButton, Portal } from 'react-native-paper';

import { DriverActionCard } from '@/components/driver-action-card';
import { RealtimeConnectionStatus } from '@/components/realtime-connection-status';
import { appConfig } from '@/config/app-config';
import { useRealtimeShipmentEvents } from '@/hooks/use-realtime-shipment-events';
import { type DailyShipmentSummary } from '@/services/conductor-api';
import { getConductorApi } from '@/services/get-conductor-api';
import { clearSessionToken } from '@/services/session-token-store';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';

const ClipboardList = require('lucide-react-native/dist/cjs/icons/clipboard-list.js') as typeof import('lucide-react-native/dist/types/icons/clipboard-list').default;
const ScanLine = require('lucide-react-native/dist/cjs/icons/scan-line.js') as typeof import('lucide-react-native/dist/types/icons/scan-line').default;
const CircleAlert = require('lucide-react-native/dist/cjs/icons/circle-alert.js') as typeof import('lucide-react-native/dist/types/icons/circle-alert').default;
const Info = require('lucide-react-native/dist/cjs/icons/info.js') as typeof import('lucide-react-native/dist/types/icons/info').default;

export default function ConductorHomeScreen() {
  const router = useRouter();
  const [shipmentCount, setShipmentCount] = useState<number | null>(null);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyShipmentSummary | null>(null);
  const [isLoadingDailySummary, setIsLoadingDailySummary] = useState(true);
  const [dailySummaryErrorMessage, setDailySummaryErrorMessage] = useState<string | null>(null);
  const [isAssignedInfoOpen, setIsAssignedInfoOpen] = useState(false);

  const refetchShipmentCount = useCallback(() => {
    return getConductorApi()
      .listAssignedShipments()
      .then((shipments) => {
        setShipmentCount(shipments.length);
        setLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        setShipmentCount(null);
        setLoadErrorMessage(
          error instanceof Error ? error.message : 'No se pudo sincronizar el conteo de encomiendas con el servidor.',
        );
      })
      .finally(() => {
        setIsLoadingAssignments(false);
      });
  }, []);

  const refetchDailySummary = useCallback(() => {
    return getConductorApi()
      .getDailyShipmentSummary()
      .then((summary) => {
        setDailySummary(summary);
        setDailySummaryErrorMessage(null);
      })
      .catch((error: unknown) => {
        setDailySummary(null);
        setDailySummaryErrorMessage(
          error instanceof Error ? error.message : 'No se pudo cargar el resumen diario.',
        );
      })
      .finally(() => {
        setIsLoadingDailySummary(false);
      });
  }, []);

  const refetchHomeData = useCallback(() => {
    void refetchShipmentCount();
    void refetchDailySummary();
  }, [refetchDailySummary, refetchShipmentCount]);

  useEffect(() => {
    refetchHomeData();
  }, [refetchHomeData]);

  const { connection, latestEvent } = useRealtimeShipmentEvents(
    refetchHomeData,
  );

  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await clearSessionToken();
    } finally {
      // Always leave the driver workspace, even if clearing the stored
      // token failed locally (e.g. secure storage unavailable) — the app
      // must never strand the driver behind an unreachable sign-out.
      router.replace('/');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ESPACIO DEL CONDUCTOR</Text>
          <Text style={styles.title}>Listo para tu ruta</Text>
          <Text style={styles.subtitle}>Revisa las encomiendas asignadas y registra la evidencia requerida desde un solo lugar.</Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.assignedColumn}>
              <View style={styles.assignedLabelRow}>
                <Text style={styles.summaryLabel}>ENCOMIENDAS ASIGNADAS</Text>
                <IconButton
                  accessibilityLabel="Qué significa este número"
                  icon={paperIcon(Info)}
                  iconColor={theme.colors.text.onDark}
                  onPress={() => setIsAssignedInfoOpen(true)}
                  size={15}
                  style={styles.infoButton}
                />
              </View>
              <View style={styles.assignedValueWrap}>
                {isLoadingAssignments ? (
                  <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
                ) : (
                  <Text style={styles.summaryValue}>{shipmentCount === null ? 'No disponible' : shipmentCount}</Text>
                )}
              </View>
            </View>

            <View style={styles.dailySummaryColumn}>
              <Text style={styles.dailySummaryLabel}>RESUMEN DIARIO</Text>
              {isLoadingDailySummary ? (
                <View style={styles.dailySummaryLoading}>
                  <ActivityIndicator accessibilityLabel="Cargando resumen diario" color={theme.colors.primary} size="small" />
                </View>
              ) : dailySummary ? (
                <View style={styles.dailySummaryGrid}>
                  <View style={styles.dailySummaryGridRow}>
                    <DailyMetricTile label="Asignadas hoy" value={dailySummary.asignadasHoy} />
                    <DailyMetricTile label="Entregadas hoy" value={dailySummary.entregadasHoy} />
                  </View>
                  <View style={styles.dailySummaryGridRow}>
                    <DailyMetricTile label="Pendientes" value={dailySummary.pendientes.total} />
                    <DailyMetricTile label="En reparto" value={dailySummary.pendientes.porEstado.en_reparto} />
                  </View>
                </View>
              ) : (
                <Text style={styles.dailySummaryHelp}>
                  {dailySummaryErrorMessage ?? 'No se pudo cargar el resumen diario.'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <Portal>
          <Dialog onDismiss={() => setIsAssignedInfoOpen(false)} style={styles.tooltipDialog} visible={isAssignedInfoOpen}>
            <Dialog.Content>
              <Text style={styles.tooltipText}>
                {shipmentCount === null
                  ? loadErrorMessage ?? 'No se pudo sincronizar el conteo de encomiendas con el servidor.'
                  : 'El conteo refleja las encomiendas asignadas a tu conductor en el servidor.'}
              </Text>
            </Dialog.Content>
          </Dialog>
        </Portal>

        <RealtimeConnectionStatus connection={connection} latestEvent={latestEvent} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <DriverActionCard
            accessibilityLabel="Abrir mis encomiendas"
            description="Revisa las encomiendas asignadas a tu turno y sucursal."
            icon={ClipboardList}
            onPress={() => router.push('/conductor/shipments')}
            title="Mis encomiendas"
          />
          <DriverActionCard
            accessibilityLabel="Abrir escáner QR"
            description="Captura un código QR desde el detalle de una encomienda."
            icon={ScanLine}
            onPress={() => router.push('/conductor/scan')}
            title="Escanear QR"
          />
          <DriverActionCard
            accessibilityLabel="Abrir historial de incidentes"
            description="Revisa las encomiendas con reportes de entrega fallida."
            icon={CircleAlert}
            onPress={() => router.push('/conductor/incident-history')}
            title="Historial de incidentes"
          />
        </View>

        {appConfig.fixturesEnabled ? <Text style={styles.fixtureNote}>Los datos de prueba de desarrollo están habilitados en este dispositivo.</Text> : null}

        <Button
          disabled={isSigningOut}
          loading={isSigningOut}
          mode="outlined"
          onPress={() => void signOut()}
          style={styles.signOutButton}
          textColor={theme.colors.text.secondary}>
          {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function DailyMetricTile({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.dailySummaryMetric}>
      <Text style={styles.dailySummaryMetricLabel}>{label}</Text>
      {value === null ? (
        <Text style={styles.dailySummaryMetricUnavailable} numberOfLines={2}>
          No disponible
        </Text>
      ) : (
        <Text style={styles.dailySummaryMetricValue}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.base, padding: theme.spacing.lg },
  header: { gap: theme.spacing.xs + 2, paddingBottom: 4 },
  eyebrow: { ...theme.typography.eyebrow },
  title: { color: theme.colors.text.primary, fontSize: 29, fontWeight: '800' },
  subtitle: { ...theme.typography.subtitle },
  statsCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    padding: theme.spacing.sm + 2,
    ...theme.shadows.card,
  },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm },
  assignedColumn: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radii.lg,
    flex: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.base,
  },
  assignedLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 0, justifyContent: 'center' },
  infoButton: { margin: 0 },
  assignedValueWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  summaryLabel: { color: theme.colors.text.onDark, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  summaryValue: { color: theme.colors.text.onSecondary, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  tooltipDialog: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg },
  tooltipText: { color: theme.colors.text.primary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dailySummaryColumn: { flex: 1.15, gap: theme.spacing.sm },
  dailySummaryLabel: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  dailySummaryLoading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  dailySummaryGrid: { flex: 1, gap: theme.spacing.xs + 2 },
  dailySummaryGridRow: { flex: 1, flexDirection: 'row', gap: theme.spacing.xs + 2 },
  dailySummaryMetric: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  dailySummaryMetricLabel: { color: theme.colors.text.secondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  dailySummaryMetricValue: { color: theme.colors.secondary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  dailySummaryMetricUnavailable: { color: theme.colors.text.muted, fontSize: 10, lineHeight: 13, textAlign: 'center' },
  dailySummaryHelp: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
  section: { gap: theme.spacing.md - 2 },
  sectionTitle: { ...theme.typography.sectionTitle, marginBottom: 2 },
  fixtureNote: { color: theme.colors.text.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  signOutButton: { borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1.5, marginTop: 2 },
});
