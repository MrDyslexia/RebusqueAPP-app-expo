import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from 'react-native-paper';

import { EmptyState } from '@/components/empty-state';
import { FullScreenImageViewer } from '@/components/full-screen-image-viewer';
import { ShipmentStatusChip } from '@/components/shipment-status-chip';
import type { AssignedShipment, ShipmentId } from '@/domain/shipment';
import { apiIdToShipmentId, getQrAction } from '@/domain/shipment';
import { getConductorApi } from '@/services/get-conductor-api';
import { useRealtimeShipmentEvents } from '@/hooks/use-realtime-shipment-events';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';

const Package = require('lucide-react-native/dist/cjs/icons/package.js') as typeof import('lucide-react-native/dist/types/icons/package').default;
const ScanLine = require('lucide-react-native/dist/cjs/icons/scan-line.js') as typeof import('lucide-react-native/dist/types/icons/scan-line').default;
const CircleAlert = require('lucide-react-native/dist/cjs/icons/circle-alert.js') as typeof import('lucide-react-native/dist/types/icons/circle-alert').default;

function readShipmentId(value: string | string[] | undefined): ShipmentId | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type DeliveryPhotoState =
  | { status: 'loading' }
  | { status: 'loaded'; uri: string }
  | { status: 'unavailable' };

export default function ShipmentDetailScreen() {
  const router = useRouter();
  const { shipmentId } = useLocalSearchParams<{ shipmentId?: string | string[] }>();
  const id = readShipmentId(shipmentId);
  const [shipment, setShipment] = useState<AssignedShipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [deliveryPhoto, setDeliveryPhoto] = useState<DeliveryPhotoState | null>(null);
  const [failureReportPhoto, setFailureReportPhoto] = useState<DeliveryPhotoState | null>(null);
  const [viewerPhotoUri, setViewerPhotoUri] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!id) {
      return Promise.resolve().then(() => {
        setIsUnavailable(true);
        setIsLoading(false);
      });
    }

    return getConductorApi()
      .getAssignedShipment(id)
      .then((result) => {
        setShipment(result);
        setIsUnavailable(!result);
      })
      .catch(() => {
        setIsUnavailable(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const showDeliveryPhoto = Boolean(id && shipment && shipment.status === 'entregada' && shipment.hasDeliveryPhoto);
  const showFailureReportPhoto = Boolean(
    id && shipment && shipment.failedAttempts > 0 && (shipment.status === 'fallida' || shipment.status === 'finalizada'),
  );

  useEffect(() => {
    if (!showDeliveryPhoto || !id) {
      return;
    }

    let cancelled = false;
    // Kicking off the async photo fetch requires an immediate "loading" state before the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeliveryPhoto({ status: 'loading' });

    getConductorApi()
      .getDeliveryPhotoUri(id)
      .then((uri) => {
        if (!cancelled) {
          setDeliveryPhoto(uri ? { status: 'loaded', uri } : { status: 'unavailable' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryPhoto({ status: 'unavailable' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, showDeliveryPhoto]);

  useEffect(() => {
    if (!showFailureReportPhoto || !id) {
      return;
    }

    let cancelled = false;
    // Kicking off the async photo fetch requires an immediate "loading" state before the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailureReportPhoto({ status: 'loading' });

    getConductorApi()
      .getFailureReportPhotoUri(id)
      .then((uri) => {
        if (!cancelled) {
          setFailureReportPhoto(uri ? { status: 'loaded', uri } : { status: 'unavailable' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailureReportPhoto({ status: 'unavailable' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, showFailureReportPhoto]);

  useRealtimeShipmentEvents(
    useCallback(
      (data) => {
        if (id && apiIdToShipmentId(data.id) === id) {
          void refetch();
        }
      },
      [id, refetch],
    ),
  );

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
  }

  if (isUnavailable || !shipment || !id) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.unavailable}>
          <EmptyState
            description="No se pudo cargar el detalle de esta encomienda. Verifica tu conexión o vuelve a intentarlo desde la lista de encomiendas."
            icon={<Package color={theme.colors.primary} size={24} />}
            title="No se pudo cargar la encomienda"
          />
        </View>
      </SafeAreaView>
    );
  }

  const qrAction = getQrAction(shipment.status);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.reference}>{shipment.reference}</Text>
            <ShipmentStatusChip status={shipment.status} />
          </View>
          <Text style={styles.title}>{shipment.recipientName}</Text>
        </View>

        <InfoRow label="Dirección de retiro" value={shipment.pickupAddress ?? 'No registrada'} />
        <InfoRow label="Dirección de entrega" value={shipment.deliveryAddress} />
        {shipment.failedAttempts > 0 ? (
          <InfoRow label="Intentos de entrega fallidos" value={String(shipment.failedAttempts)} />
        ) : null}

        {showDeliveryPhoto ? (
          <PhotoCard
            label="Foto de entrega"
            onOpenViewer={() => deliveryPhoto?.status === 'loaded' && setViewerPhotoUri(deliveryPhoto.uri)}
            photo={deliveryPhoto}
            unavailableMessage="No se pudo cargar la foto de entrega."
          />
        ) : null}

        {showFailureReportPhoto ? (
          <PhotoCard
            label="Foto del reporte de falla"
            onOpenViewer={() => failureReportPhoto?.status === 'loaded' && setViewerPhotoUri(failureReportPhoto.uri)}
            photo={failureReportPhoto}
            unavailableMessage="No hay foto de evidencia para el reporte de falla."
          />
        ) : null}

        <View style={styles.actions}>
          {qrAction ? (
            <Button
              icon={paperIcon(ScanLine)}
              mode="contained"
              onPress={() => router.push({ pathname: '/conductor/scan/[shipmentId]', params: { action: qrAction.action, reference: shipment.reference, shipmentId: id } })}
              style={styles.primaryButton}>
              {qrAction.label}
            </Button>
          ) : null}

          {shipment.status === 'en_reparto' ? (
            <Button
              icon={paperIcon(ScanLine)}
              mode="contained"
              onPress={() => router.push({ pathname: '/conductor/[shipmentId]/delivery', params: { reference: shipment.reference, shipmentId: id } })}
              style={styles.primaryButton}>
              Confirmar entrega
            </Button>
          ) : null}

          {shipment.status === 'en_reparto' ? (
            <Button
              icon={paperIcon(CircleAlert)}
              mode="outlined"
              onPress={() => router.push({ pathname: '/conductor/report-failure', params: { reference: shipment.reference, shipmentId: id } })}
              style={styles.secondaryButton}
              textColor={theme.colors.status.danger.text}>
              Reportar falla de entrega
            </Button>
          ) : null}
        </View>
      </ScrollView>

      <FullScreenImageViewer onClose={() => setViewerPhotoUri(null)} uri={viewerPhotoUri} />
    </SafeAreaView>
  );
}

function PhotoCard({
  label,
  onOpenViewer,
  photo,
  unavailableMessage,
}: {
  label: string;
  onOpenViewer: () => void;
  photo: DeliveryPhotoState | null;
  unavailableMessage: string;
}) {
  return (
    <Card style={styles.photoCard}>
      <Card.Content style={styles.photoCardContent}>
        <Text style={styles.label}>{label}</Text>
        {photo?.status === 'loaded' ? (
          <Pressable accessibilityLabel={`Ver ${label.toLocaleLowerCase()} en pantalla completa`} accessibilityRole="button" onPress={onOpenViewer}>
            <Image resizeMode="cover" source={{ uri: photo.uri }} style={styles.photoImage} />
            <Text style={styles.photoHint}>Toca la foto para verla en pantalla completa</Text>
          </Pressable>
        ) : photo?.status === 'unavailable' ? (
          <Text style={styles.photoMessage}>{unavailableMessage}</Text>
        ) : (
          <View style={styles.photoLoading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  centered: { alignItems: 'center', backgroundColor: theme.colors.background, flex: 1, justifyContent: 'center' },
  unavailable: { padding: theme.spacing.lg },
  content: { gap: theme.spacing.md + 2, padding: theme.spacing.lg },
  header: { gap: theme.spacing.xs + 3 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reference: { color: theme.colors.secondary, fontSize: 14, fontWeight: '800' },
  title: { ...theme.typography.title },
  infoRow: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 4, padding: theme.spacing.base - 2 },
  label: { color: theme.colors.text.secondary, fontSize: 13, fontWeight: '700' },
  value: { color: theme.colors.text.primary, fontSize: 16 },
  photoCard: { borderRadius: theme.radii.xl },
  photoCardContent: { gap: theme.spacing.sm },
  photoImage: { borderRadius: theme.radii.lg, height: 220, width: '100%' },
  photoLoading: { alignItems: 'center', height: 220, justifyContent: 'center' },
  photoMessage: { color: theme.colors.text.secondary, fontSize: 14 },
  photoHint: { color: theme.colors.text.muted, fontSize: 12, marginTop: theme.spacing.xs, textAlign: 'center' },
  actions: { gap: theme.spacing.sm + 2, marginTop: 2 },
  primaryButton: { borderRadius: theme.radii.pill },
  secondaryButton: { borderColor: theme.colors.status.danger.border, borderRadius: theme.radii.pill },
});
