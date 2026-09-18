import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from 'react-native-paper';

import { PhotoEvidenceField, type CapturedPhoto } from '@/components/photo-evidence-field';
import { QrScanner } from '@/components/qr-scanner';
import { StatusNotice } from '@/components/status-notice';
import type { ShipmentId } from '@/domain/shipment';
import { getConductorApi } from '@/services/get-conductor-api';
import { theme } from '@/theme';

function readShipmentId(value: string | string[] | undefined): ShipmentId | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default function DeliveryConfirmationScreen() {
  const router = useRouter();
  const { qrCaptured, reference, shipmentId } = useLocalSearchParams<{
    qrCaptured?: string | string[];
    reference?: string | string[];
    shipmentId?: string | string[];
  }>();
  const id = readShipmentId(shipmentId);
  const label = readShipmentId(reference) ?? undefined;
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isQrStepComplete = qrCaptured === 'true';

  if (!id) {
    return <QrScanner action="unassigned" />;
  }

  const confirmedShipmentId = id;

  async function confirmDelivery() {
    if (!photo) {
      setSubmitError('Toma la foto de entrega antes de confirmar.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await getConductorApi().deliverShipment(confirmedShipmentId, photo.base64);
      router.replace({ pathname: '/conductor/[shipmentId]', params: { shipmentId: confirmedShipmentId } });
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible confirmar la entrega.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Confirmar entrega</Text>
        <Text style={styles.description}>Escanea primero el QR de entrega y luego agrega una foto de respaldo si es necesario.</Text>

        {!isQrStepComplete ? (
          <Card style={styles.qrStep}>
            <Card.Content style={styles.qrStepContent}>
              <Text style={styles.stepTitle}>1. Escanear QR de entrega</Text>
              <Text style={styles.stepText}>El escaneo se registra localmente. El estado de la entrega no cambiará hasta que confirmes la entrega en el siguiente paso.</Text>
              <Button
                mode="outlined"
                onPress={() => router.push({ pathname: '/conductor/scan/[shipmentId]', params: { action: 'delivery', reference: label, shipmentId: id } })}
                style={styles.secondaryButton}>
                Abrir escáner de entrega
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {isQrStepComplete ? (
          <Card style={styles.formCard}>
            <Card.Content style={styles.formCardContent}>
              <Text style={styles.stepTitle}>2. Foto de entrega (obligatoria)</Text>
              <PhotoEvidenceField onChange={setPhoto} photo={photo} required />

              {submitError ? <StatusNotice variant="danger">{submitError}</StatusNotice> : null}

              <Button
                disabled={isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => void confirmDelivery()}
                style={styles.primaryButton}>
                Confirmar entrega
              </Button>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.md + 2, padding: theme.spacing.lg },
  title: { ...theme.typography.title },
  description: { ...theme.typography.subtitle, fontSize: 15 },
  qrStep: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, ...theme.shadows.card },
  qrStepContent: { gap: theme.spacing.sm + 2 },
  formCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, ...theme.shadows.card },
  formCardContent: { gap: theme.spacing.md },
  stepTitle: { color: theme.colors.text.primary, fontSize: 17, fontWeight: '800' },
  stepText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
  secondaryButton: { borderColor: theme.colors.primary, borderRadius: theme.radii.pill },
  primaryButton: { borderRadius: theme.radii.pill },
});
