import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DriverActionCard } from '@/components/driver-action-card';
import { RealtimeConnectionStatus } from '@/components/realtime-connection-status';
import { appConfig } from '@/config/app-config';
import { useRealtimeShipmentEvents } from '@/hooks/use-realtime-shipment-events';
import { getConductorApi } from '@/services/get-conductor-api';
import { clearSessionToken } from '@/services/session-token-store';
import { theme } from '@/theme';

const ClipboardList = require('lucide-react-native/dist/cjs/icons/clipboard-list.js') as typeof import('lucide-react-native/dist/types/icons/clipboard-list').default;
const ScanLine = require('lucide-react-native/dist/cjs/icons/scan-line.js') as typeof import('lucide-react-native/dist/types/icons/scan-line').default;
const CircleAlert = require('lucide-react-native/dist/cjs/icons/circle-alert.js') as typeof import('lucide-react-native/dist/types/icons/circle-alert').default;

export default function ConductorHomeScreen() {
  const router = useRouter();
  const [shipmentCount, setShipmentCount] = useState<number | null>(null);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    void refetchShipmentCount();
  }, [refetchShipmentCount]);

  const { connection, latestEvent } = useRealtimeShipmentEvents(
    useCallback(() => void refetchShipmentCount(), [refetchShipmentCount]),
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

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>ENCOMIENDAS ASIGNADAS</Text>
          {isLoadingAssignments ? (
            <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
          ) : (
            <Text style={styles.summaryValue}>{shipmentCount === null ? 'No disponible' : shipmentCount}</Text>
          )}
          <Text style={styles.summaryHelp}>
            {shipmentCount === null
              ? loadErrorMessage ?? 'No se pudo sincronizar el conteo de encomiendas con el servidor.'
              : 'El conteo refleja las encomiendas asignadas a tu conductor en el servidor.'}
          </Text>
        </View>

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

        <Pressable
          accessibilityLabel="Cerrar sesión"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSigningOut }}
          disabled={isSigningOut}
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
          <Text style={styles.signOutButtonText}>{isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.base, padding: theme.spacing.lg },
  header: { gap: theme.spacing.xs + 2, paddingBottom: 4 },
  eyebrow: { ...theme.typography.eyebrow },
  title: { color: theme.colors.text.primary, fontSize: 29, fontWeight: '800' },
  subtitle: { ...theme.typography.subtitle },
  summaryCard: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radii.xl,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg + 2,
    ...theme.shadows.card,
  },
  summaryLabel: { color: theme.colors.text.onDark, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  summaryValue: { color: theme.colors.text.onSecondary, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  summaryHelp: { color: theme.colors.text.onDark, fontSize: 13, lineHeight: 18 },
  section: { gap: theme.spacing.md - 2 },
  sectionTitle: { ...theme.typography.sectionTitle, marginBottom: 2 },
  fixtureNote: { color: theme.colors.text.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  signOutButton: { alignItems: 'center', borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1.5, marginTop: 2, minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.base },
  signOutButtonPressed: { backgroundColor: theme.colors.surfacePressed },
  signOutButtonText: { color: theme.colors.text.secondary, fontSize: 14, fontWeight: '800' },
});
