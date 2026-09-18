import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from 'react-native-paper';

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
        <Button mode="contained" onPress={() => void requestPermission()} style={styles.permissionButton}>
          Permitir acceso a la cámara
        </Button>
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
          <Card accessibilityLiveRegion="polite" style={styles.result}>
            <Card.Content style={styles.resultContent}>
              <Text style={styles.resultTitle}>Escaneo capturado localmente</Text>
              <Text numberOfLines={2} style={styles.resultValue}>{capturedValue}</Text>
              {submitError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{submitError}</Text> : null}
              <Button disabled={isSubmitting} mode="outlined" onPress={resetCapture} style={styles.secondaryButton}>
                Escanear otro código
              </Button>
              {onConfirm ? (
                <Button
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  mode="contained"
                  onPress={() => void handleConfirm()}
                  style={styles.continueButton}>
                  {copy.confirmLabel}
                </Button>
              ) : null}
            </Card.Content>
          </Card>
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
  permissionButton: { borderRadius: theme.radii.pill, marginTop: theme.spacing.xs },
  overlay: { backgroundColor: theme.colors.overlay.scannerBackdrop, gap: theme.spacing.sm + 2, padding: theme.spacing.xl },
  heading: { ...theme.typography.sectionTitle, color: theme.colors.text.onSecondary, textAlign: 'center' },
  context: { color: theme.colors.text.onDark, fontSize: 13, textAlign: 'center' },
  helpText: { color: theme.colors.text.onDark, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  result: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    ...theme.shadows.card,
  },
  resultContent: { gap: theme.spacing.sm, padding: theme.spacing.md + 2 },
  resultTitle: { color: theme.colors.secondary, fontSize: 16, fontWeight: '800' },
  resultValue: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
  secondaryButton: { borderColor: theme.colors.primary, borderRadius: theme.radii.pill, marginTop: 4 },
  continueButton: { borderRadius: theme.radii.pill },
  error: { color: theme.colors.status.danger.border, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
