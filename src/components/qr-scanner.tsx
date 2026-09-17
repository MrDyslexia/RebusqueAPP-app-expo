import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ShipmentId } from '@/domain/shipment';
import { theme } from '@/theme';

export type DriverQrAction = 'withdrawal' | 'loading' | 'delivery' | 'unassigned';

interface QrScannerProps {
  action: DriverQrAction;
  /**
   * Called once the driver confirms a captured QR code. For 'withdrawal' and
   * 'loading' this should trigger the real backend transition
   * (pickupShipment / loadShipment) and throw with a user-safe message on
   * failure. For 'delivery' it only advances to the delivery confirmation
   * screen. Omit for 'unassigned' scans.
   */
  onConfirm?: (rawValue: string) => Promise<void>;
  shipmentId?: ShipmentId;
  /**
   * Human-readable tracking reference (e.g. "RBQ-AKY8LBJY") shown in the
   * context line instead of the raw backend id, so the driver can recognize
   * which shipment they are about to scan for. Falls back to `shipmentId`
   * when not provided (e.g. the standalone home "Escanear QR" entry point,
   * which has not resolved a shipment yet).
   */
  shipmentLabel?: string;
}

const actionCopy: Record<DriverQrAction, { heading: string; help: string; confirmLabel: string }> = {
  withdrawal: {
    heading: 'Confirmar retiro con QR',
    help: 'Escanea el código QR de la encomienda seleccionada para confirmar el retiro.',
    confirmLabel: 'Confirmar retiro',
  },
  loading: {
    heading: 'Confirmar carga con QR',
    help: 'Escanea el código QR de la encomienda seleccionada para confirmar la carga.',
    confirmLabel: 'Confirmar carga',
  },
  delivery: {
    heading: 'Confirmar entrega con QR',
    help: 'Escanea el código QR de la encomienda seleccionada para continuar con la confirmación de entrega.',
    confirmLabel: 'Continuar a confirmación de entrega',
  },
  unassigned: {
    heading: 'Escanear el código QR de una encomienda',
    help: 'Escanea el código QR de una encomienda para buscarla y ver la acción disponible.',
    confirmLabel: 'Buscar encomienda',
  },
};

export function QrScanner({ action, onConfirm, shipmentId, shipmentLabel }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedValue, setCapturedValue] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const copy = actionCopy[action];

  if (!permission) {
    return <View style={styles.messageContainer} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.permissionTitle}>Se requiere permiso de cámara</Text>
        <Text style={styles.message}>Se requiere acceso a la cámara para escanear el código QR de una encomienda.</Text>
        <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Permitir acceso a la cámara</Text>
        </Pressable>
      </View>
    );
  }

  function resetCapture() {
    setCapturedValue(null);
    setSubmitError(null);
  }

  async function handleConfirm() {
    if (!capturedValue || !onConfirm) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onConfirm(capturedValue);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible completar la acción.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={capturedValue ? undefined : (event) => setCapturedValue(event.data)}
        onMountError={() => setCameraError('No se pudo iniciar la vista previa de la cámara en este dispositivo.')}
        style={styles.camera}
      />
      <View style={styles.overlay}>
        <Text style={styles.heading}>{copy.heading}</Text>
        {shipmentId ? <Text style={styles.context}>Encomienda seleccionada: {shipmentLabel ?? shipmentId}</Text> : null}
        {cameraError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{cameraError}</Text> : null}
        {capturedValue ? (
          <View accessibilityLiveRegion="polite" style={styles.result}>
            <Text style={styles.resultTitle}>Escaneo capturado localmente</Text>
            <Text numberOfLines={2} style={styles.resultValue}>{capturedValue}</Text>
            {submitError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{submitError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={resetCapture}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Escanear otro código</Text>
            </Pressable>
            {onConfirm ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting }}
                disabled={isSubmitting}
                onPress={() => void handleConfirm()}
                style={[styles.continueButton, isSubmitting && styles.disabledButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>{copy.confirmLabel}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.helpText}>{copy.help}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.secondaryDeep, flex: 1 },
  camera: { flex: 1 },
  messageContainer: { alignItems: 'center', backgroundColor: theme.colors.background, flex: 1, gap: theme.spacing.md + 2, justifyContent: 'center', padding: theme.spacing.xl },
  permissionTitle: { ...theme.typography.sectionTitle, textAlign: 'center' },
  message: { ...theme.typography.subtitle, fontSize: 15, textAlign: 'center' },
  permissionButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, minHeight: 46, justifyContent: 'center', paddingHorizontal: theme.spacing.base },
  permissionButtonText: { ...theme.typography.buttonLabel, color: theme.colors.text.onPrimary, fontSize: 15 },
  overlay: { backgroundColor: theme.colors.overlay.scannerBackdrop, gap: theme.spacing.sm + 2, padding: theme.spacing.xl },
  heading: { ...theme.typography.sectionTitle, color: theme.colors.text.onSecondary, textAlign: 'center' },
  context: { color: theme.colors.text.onDark, fontSize: 13, textAlign: 'center' },
  helpText: { color: theme.colors.text.onDark, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  result: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md + 2,
    ...theme.shadows.card,
  },
  resultTitle: { color: theme.colors.secondary, fontSize: 16, fontWeight: '800' },
  resultValue: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
  resultText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
  secondaryButton: { alignItems: 'center', borderColor: theme.colors.primary, borderRadius: theme.radii.pill, borderWidth: 1.5, marginTop: 4, minHeight: 42, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
  secondaryButtonText: { color: theme.colors.primary, fontSize: 14, fontWeight: '800' },
  continueButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, minHeight: 42, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
  continueButtonText: { ...theme.typography.buttonLabel, color: theme.colors.text.onPrimary, fontSize: 14 },
  disabledButton: { opacity: 0.65 },
  error: { color: theme.colors.status.danger.border, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
