import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, IconButton } from 'react-native-paper';

import { ShipmentStatusChip } from '@/components/shipment-status-chip';
import type { AssignedShipment } from '@/domain/shipment';
import { getQrAction } from '@/domain/shipment';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';

const X = require('lucide-react-native/dist/cjs/icons/x.js') as typeof import('lucide-react-native/dist/types/icons/x').default;
const CircleAlert = require('lucide-react-native/dist/cjs/icons/circle-alert.js') as typeof import('lucide-react-native/dist/types/icons/circle-alert').default;

interface QrResolvedShipmentPanelProps {
  shipment: AssignedShipment;
  /** Closes the panel and returns the driver to the home screen. No side effects. */
  onClose: () => void;
  /**
   * Executes the real backend transition (`pickupShipment` / `loadShipment`)
   * for the QR-driven action matching `shipment.status`. Throws with a
   * driver-safe message on failure; the panel surfaces it inline and stays
   * open so the driver can retry or close.
   */
  onConfirmAction: (action: 'withdrawal' | 'loading') => Promise<void>;
  /** Navigates to the delivery confirmation screen with the QR step already satisfied. */
  onGoToDelivery: () => void;
  /** Navigates to the delivery-failure report screen for this shipment. */
  onReportFailure: () => void;
}

/**
 * Post-resolve result block for the standalone home QR scanner
 * (`src/app/conductor/scan/index.tsx`). Rendered in place of the camera once
 * a scan resolves to a shipment: shows enough identity context to confirm
 * it's the right one, and the single valid next action for its current
 * `status` (via `getQrAction`) — never auto-executed, always an explicit tap.
 */
export function QrResolvedShipmentPanel({ shipment, onClose, onConfirmAction, onGoToDelivery, onReportFailure }: QrResolvedShipmentPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrAction = getQrAction(shipment.status);
  const isDelivery = shipment.status === 'en_reparto';

  async function handleConfirmAction() {
    if (!qrAction) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirmAction(qrAction.action);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la acción.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const actionLabel = qrAction?.action === 'withdrawal' ? 'Confirmar retiro' : qrAction?.action === 'loading' ? 'Confirmar carga' : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Card style={styles.panel}>
          <Card.Content style={styles.panelContent}>
            <IconButton
              accessibilityLabel="Cerrar"
              icon={paperIcon(X)}
              onPress={onClose}
              size={22}
              style={styles.closeButton}
            />

            <View style={styles.header}>
              <Text style={styles.reference}>{shipment.reference}</Text>
              <ShipmentStatusChip status={shipment.status} />
            </View>
            <Text style={styles.recipient}>{shipment.recipientName}</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isDelivery ? (
              <Button mode="contained" onPress={onGoToDelivery} style={styles.primaryButton}>
                Confirmar entrega
              </Button>
            ) : actionLabel ? (
              <Button
                disabled={isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => void handleConfirmAction()}
                style={styles.primaryButton}>
                {actionLabel}
              </Button>
            ) : (
              <Text style={styles.noActionText}>No hay ninguna acción disponible para esta encomienda en este momento.</Text>
            )}

            {isDelivery ? (
              <Button
                icon={paperIcon(CircleAlert)}
                mode="outlined"
                onPress={onReportFailure}
                style={styles.secondaryButton}
                textColor={theme.colors.status.danger.text}>
                Reportar falla de entrega
              </Button>
            ) : null}
          </Card.Content>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  panel: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    ...theme.shadows.card,
  },
  panelContent: { gap: theme.spacing.md },
  closeButton: { alignSelf: 'flex-end', marginBottom: -theme.spacing.sm, marginRight: -theme.spacing.sm, marginTop: -theme.spacing.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reference: { color: theme.colors.secondary, fontSize: 14, fontWeight: '800' },
  recipient: { ...theme.typography.title, fontSize: 20 },
  noActionText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
  primaryButton: { borderRadius: theme.radii.pill },
  secondaryButton: { borderColor: theme.colors.status.danger.border, borderRadius: theme.radii.pill },
  errorText: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
});
