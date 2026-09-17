import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShipmentStatusChip } from '@/components/shipment-status-chip';
import type { AssignedShipment } from '@/domain/shipment';
import { getQrAction } from '@/domain/shipment';
import { theme } from '@/theme';

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
        <View style={styles.panel}>
          <Pressable accessibilityLabel="Cerrar" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <X color={theme.colors.text.secondary} size={22} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.reference}>{shipment.reference}</Text>
            <ShipmentStatusChip status={shipment.status} />
          </View>
          <Text style={styles.recipient}>{shipment.recipientName}</Text>

          {error ? (
            <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {isDelivery ? (
            <Pressable accessibilityRole="button" onPress={onGoToDelivery} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>Confirmar entrega</Text>
            </Pressable>
          ) : actionLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void handleConfirmAction()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, isSubmitting && styles.disabledButton]}>
              {isSubmitting ? <ActivityIndicator color={theme.colors.text.onPrimary} size="small" /> : <Text style={styles.primaryButtonText}>{actionLabel}</Text>}
            </Pressable>
          ) : (
            <Text style={styles.noActionText}>No hay ninguna acción disponible para esta encomienda en este momento.</Text>
          )}

          {isDelivery ? (
            <Pressable accessibilityRole="button" onPress={onReportFailure} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
              <CircleAlert color={theme.colors.status.danger.text} size={18} />
              <Text style={styles.secondaryButtonText}>Reportar falla de entrega</Text>
            </Pressable>
          ) : null}
        </View>
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
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  closeButton: { alignItems: 'center', alignSelf: 'flex-end', height: 32, justifyContent: 'center', marginBottom: -theme.spacing.sm, width: 32 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reference: { color: theme.colors.secondary, fontSize: 14, fontWeight: '800' },
  recipient: { ...theme.typography.title, fontSize: 20 },
  noActionText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', minHeight: 50, paddingHorizontal: theme.spacing.base },
  primaryButtonPressed: { backgroundColor: theme.colors.primaryPressed },
  primaryButtonText: { ...theme.typography.buttonLabel, color: theme.colors.text.onPrimary, fontSize: 15 },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.status.danger.border, borderRadius: theme.radii.pill, borderWidth: 1, flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', minHeight: 50, paddingHorizontal: theme.spacing.base },
  secondaryButtonPressed: { backgroundColor: theme.colors.status.danger.background },
  secondaryButtonText: { color: theme.colors.status.danger.text, fontSize: 15, fontWeight: '800' },
  errorNotice: { backgroundColor: theme.colors.status.danger.background, borderColor: theme.colors.status.danger.border, borderWidth: 1, borderRadius: theme.radii.md, padding: theme.spacing.md },
  errorText: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
});
