import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoEvidenceField, type CapturedPhoto } from '@/components/photo-evidence-field';
import { QrScanner } from '@/components/qr-scanner';
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
          <View style={styles.qrStep}>
            <Text style={styles.stepTitle}>1. Escanear QR de entrega</Text>
            <Text style={styles.stepText}>El escaneo se registra localmente. El estado de la entrega no cambiará hasta que confirmes la entrega en el siguiente paso.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/conductor/scan/[shipmentId]', params: { action: 'delivery', reference: label, shipmentId: id } })}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
              <Text style={styles.secondaryButtonText}>Abrir escáner de entrega</Text>
            </Pressable>
          </View>
        ) : null}

        {isQrStepComplete ? (
          <View style={styles.formCard}>
            <Text style={styles.stepTitle}>2. Foto de entrega (obligatoria)</Text>
            <PhotoEvidenceField onChange={setPhoto} photo={photo} required />

            {submitError ? (
              <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void confirmDelivery()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, isSubmitting && styles.disabledButton]}>
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirmar entrega</Text>
              )}
            </Pressable>
          </View>
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
  qrStep: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, gap: theme.spacing.sm + 2, padding: theme.spacing.base, ...theme.shadows.card },
  formCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, gap: theme.spacing.md, padding: theme.spacing.base, ...theme.shadows.card },
  stepTitle: { color: theme.colors.text.primary, fontSize: 17, fontWeight: '800' },
  stepText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
  secondaryButton: { alignItems: 'center', borderColor: theme.colors.primary, borderRadius: theme.radii.pill, borderWidth: 1.5, minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.md + 2 },
  secondaryButtonPressed: { backgroundColor: theme.colors.primarySoft },
  secondaryButtonText: { color: theme.colors.primary, fontSize: 14, fontWeight: '800' },
  primaryButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.base },
  primaryButtonPressed: { backgroundColor: theme.colors.primaryPressed },
  primaryButtonText: { ...theme.typography.buttonLabel, color: theme.colors.text.onPrimary, fontSize: 15 },
  disabledButton: { opacity: 0.65 },
  errorNotice: { backgroundColor: theme.colors.status.danger.background, borderColor: theme.colors.status.danger.border, borderWidth: 1, borderRadius: theme.radii.md, padding: theme.spacing.md },
  errorText: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
});
