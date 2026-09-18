import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, TextInput } from 'react-native-paper';

import { PhotoEvidenceField, type CapturedPhoto } from '@/components/photo-evidence-field';
import { StatusNotice } from '@/components/status-notice';
import type { ShipmentId } from '@/domain/shipment';
import { getConductorApi } from '@/services/get-conductor-api';
import { theme } from '@/theme';

function readShipmentId(value: string | string[] | undefined): ShipmentId | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface ReportResult {
  reachedMaxAttempts: boolean;
}

export default function ReportFailureScreen() {
  const router = useRouter();
  const { reference, shipmentId } = useLocalSearchParams<{ reference?: string | string[]; shipmentId?: string | string[] }>();
  const id = readShipmentId(shipmentId);
  const label = readShipmentId(reference) ?? id;
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  async function submitReport() {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setReasonError('El motivo de la falla de entrega es obligatorio.');
      return;
    }

    if (!id) {
      setSubmitError('No hay ninguna encomienda seleccionada. Abre esta pantalla desde el detalle de una encomienda.');
      return;
    }

    setReasonError(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const updated = await getConductorApi().reportFailedDelivery(id, trimmedReason, photo?.base64);
      setResult({ reachedMaxAttempts: updated.status === 'finalizada' });
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible enviar el reporte.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reportar falla de entrega</Text>
        <Text style={styles.description}>
          Registra lo ocurrido antes de que se pueda reintentar la entrega. El motivo es obligatorio; la foto es opcional.
        </Text>
        {id ? <Text style={styles.context}>Encomienda seleccionada: {label}</Text> : <Text style={styles.context}>No hay ninguna encomienda seleccionada. Abre esta pantalla desde el detalle de una encomienda.</Text>}

        <Card style={styles.formCard}>
          <Card.Content style={styles.formCardContent}>
            <Text style={styles.label}>Motivo de la falla de entrega</Text>
            <TextInput
              accessibilityLabel="Motivo de la falla de entrega"
              accessibilityHint={reasonError ?? 'Obligatorio antes de poder enviar el reporte.'}
              editable={!isSubmitting && !result}
              error={Boolean(reasonError)}
              mode="outlined"
              multiline
              onChangeText={(value) => {
                setReason(value);
                if (reasonError) {
                  setReasonError(null);
                }
              }}
              placeholder="Describe el motivo de la falla de entrega"
              style={styles.input}
              value={reason}
            />
            {reasonError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{reasonError}</Text> : null}

            <Text style={styles.label}>Foto de evidencia</Text>
            <PhotoEvidenceField onChange={setPhoto} photo={photo} />

            {submitError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{submitError}</Text> : null}

            {result ? null : (
              <Button
                disabled={isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => void submitReport()}
                style={styles.primaryButton}>
                Enviar reporte
              </Button>
            )}

            {result ? (
              <View accessibilityLiveRegion="polite" style={styles.resultNotice}>
                <StatusNotice variant={result.reachedMaxAttempts ? 'warning' : 'success'}>
                  <Text style={styles.resultTitle}>
                    {result.reachedMaxAttempts ? 'Se alcanzó el máximo de intentos' : 'Reporte enviado'}
                  </Text>
                  {'\n'}
                  {result.reachedMaxAttempts
                    ? 'La encomienda alcanzó 3 intentos fallidos de entrega y quedó finalizada. Un ejecutivo o administrador debe gestionar los próximos pasos.'
                    : 'El reporte de falla de entrega se registró en el servidor.'}
                </StatusNotice>
                <Button
                  mode="text"
                  onPress={() => id && router.replace({ pathname: '/conductor/[shipmentId]', params: { shipmentId: id } })}
                  style={styles.linkButton}>
                  Volver al detalle de la encomienda
                </Button>
              </View>
            ) : null}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.md + 2, padding: theme.spacing.lg },
  title: { ...theme.typography.title },
  description: { ...theme.typography.subtitle, fontSize: 15 },
  context: { ...theme.typography.caption },
  formCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, ...theme.shadows.card },
  formCardContent: { gap: theme.spacing.sm + 2 },
  label: { color: theme.colors.text.primary, fontSize: 14, fontWeight: '800', marginTop: 4 },
  input: { minHeight: 120 },
  error: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
  primaryButton: { borderRadius: theme.radii.pill, marginTop: 4 },
  resultNotice: { gap: theme.spacing.xs, marginTop: 2 },
  resultTitle: { fontSize: 14, fontWeight: '800' },
  linkButton: { alignSelf: 'flex-start', marginTop: 4 },
});
