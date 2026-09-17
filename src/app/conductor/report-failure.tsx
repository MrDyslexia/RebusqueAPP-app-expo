import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoEvidenceField, type CapturedPhoto } from '@/components/photo-evidence-field';
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

        <View style={styles.formCard}>
          <Text style={styles.label}>Motivo de la falla de entrega</Text>
          <TextInput
            accessibilityLabel="Motivo de la falla de entrega"
            accessibilityHint={reasonError ?? 'Obligatorio antes de poder enviar el reporte.'}
            editable={!isSubmitting && !result}
            multiline
            onChangeText={(value) => {
              setReason(value);
              if (reasonError) {
                setReasonError(null);
              }
            }}
            placeholder="Describe el motivo de la falla de entrega"
            style={[styles.input, reasonError && styles.inputError]}
            textAlignVertical="top"
            value={reason}
          />
          {reasonError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{reasonError}</Text> : null}

          <Text style={styles.label}>Foto de evidencia</Text>
          <PhotoEvidenceField onChange={setPhoto} photo={photo} />

          {submitError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{submitError}</Text> : null}

          {result ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void submitReport()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, isSubmitting && styles.disabledButton]}>
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar reporte</Text>
              )}
            </Pressable>
          )}

          {result ? (
            <View accessibilityLiveRegion="polite" style={result.reachedMaxAttempts ? styles.maxAttemptsNotice : styles.successNotice}>
              <Text style={result.reachedMaxAttempts ? styles.maxAttemptsTitle : styles.successTitle}>
                {result.reachedMaxAttempts ? 'Se alcanzó el máximo de intentos' : 'Reporte enviado'}
              </Text>
              <Text style={result.reachedMaxAttempts ? styles.maxAttemptsText : styles.successText}>
                {result.reachedMaxAttempts
                  ? 'La encomienda alcanzó 3 intentos fallidos de entrega y quedó finalizada. Un ejecutivo o administrador debe gestionar los próximos pasos.'
                  : 'El reporte de falla de entrega se registró en el servidor.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => id && router.replace({ pathname: '/conductor/[shipmentId]', params: { shipmentId: id } })}
                style={styles.linkButton}>
                <Text style={styles.linkButtonText}>Volver al detalle de la encomienda</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
  formCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, borderWidth: 1, gap: theme.spacing.sm + 2, padding: theme.spacing.base, ...theme.shadows.card },
  label: { color: theme.colors.text.primary, fontSize: 14, fontWeight: '800', marginTop: 4 },
  input: { borderColor: theme.colors.borderStrong, borderRadius: theme.radii.md, borderWidth: 1, color: theme.colors.text.primary, fontSize: 15, minHeight: 120, padding: theme.spacing.md },
  inputError: { borderColor: theme.colors.status.danger.text },
  error: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
  primaryButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, minHeight: 48, justifyContent: 'center', marginTop: 4, paddingHorizontal: theme.spacing.base },
  primaryButtonPressed: { backgroundColor: theme.colors.primaryPressed },
  primaryButtonText: { ...theme.typography.buttonLabel, color: theme.colors.text.onPrimary, fontSize: 15 },
  disabledButton: { opacity: 0.65 },
  successNotice: { backgroundColor: theme.colors.status.success.background, borderColor: theme.colors.status.success.border, borderRadius: theme.radii.md, borderWidth: 1, gap: 5, marginTop: 2, padding: theme.spacing.md },
  successTitle: { color: theme.colors.status.success.text, fontSize: 14, fontWeight: '800' },
  successText: { color: theme.colors.status.success.text, fontSize: 13, lineHeight: 18 },
  maxAttemptsNotice: { backgroundColor: theme.colors.status.warning.background, borderColor: theme.colors.status.warning.border, borderRadius: theme.radii.md, borderWidth: 1, gap: 5, marginTop: 2, padding: theme.spacing.md },
  maxAttemptsTitle: { color: theme.colors.status.warning.text, fontSize: 14, fontWeight: '800' },
  maxAttemptsText: { color: theme.colors.status.warning.text, fontSize: 13, lineHeight: 18 },
  linkButton: { alignSelf: 'flex-start', marginTop: 4, minHeight: 36, justifyContent: 'center' },
  linkButtonText: { color: theme.colors.primary, fontSize: 13, fontWeight: '800' },
});
