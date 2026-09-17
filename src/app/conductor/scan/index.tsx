import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { QrResolvedShipmentPanel } from '@/components/qr-resolved-shipment-panel';
import { QrScanner } from '@/components/qr-scanner';
import type { AssignedShipment } from '@/domain/shipment';
import { getConductorApi } from '@/services/get-conductor-api';
import { resolveShipmentByQrCode, runTransitionAfterQrMatch } from '@/services/qr-resolution';

/**
 * Standalone "unassigned" scanner entry point (home's "Escanear QR" quick
 * action). A scan here only *identifies* a shipment — it never auto-executes
 * a transition or silently navigates away. Once the QR resolves, the camera
 * is replaced by `QrResolvedShipmentPanel`, which shows the shipment's
 * identity (reference, status, recipient) and the single valid next action
 * for its current status (`getQrAction`), left for the driver to explicitly
 * confirm. The driver can always close the panel (X) to return home with no
 * side effects, and any transition failure stays inline in the panel so the
 * driver can retry without losing context.
 *
 * If the resolve call itself fails (invalid/unknown QR, 403/409/etc.), there
 * is no shipment to show — that error stays in `QrScanner`'s own inline
 * error UI and the panel never mounts.
 */
export default function StandaloneQrScannerScreen() {
  const router = useRouter();
  const [resolvedShipment, setResolvedShipment] = useState<AssignedShipment | null>(null);

  const handleClose = useCallback(() => {
    setResolvedShipment(null);
    router.replace('/conductor');
  }, [router]);

  if (resolvedShipment) {
    return (
      <QrResolvedShipmentPanel
        onClose={handleClose}
        onConfirmAction={async (action) => {
          const api = getConductorApi();
          const updated = await runTransitionAfterQrMatch(() =>
            action === 'withdrawal' ? api.pickupShipment(resolvedShipment.id) : api.loadShipment(resolvedShipment.id),
          );

          router.replace({ pathname: '/conductor/[shipmentId]', params: { shipmentId: updated.id } });
        }}
        onGoToDelivery={() =>
          router.replace({
            pathname: '/conductor/[shipmentId]/delivery',
            params: { qrCaptured: 'true', shipmentId: resolvedShipment.id },
          })
        }
        onReportFailure={() => router.push({ pathname: '/conductor/report-failure', params: { shipmentId: resolvedShipment.id } })}
        shipment={resolvedShipment}
      />
    );
  }

  return (
    <QrScanner
      action="unassigned"
      onConfirm={async (rawValue) => {
        const api = getConductorApi();
        const resolved = await resolveShipmentByQrCode(api, rawValue);
        setResolvedShipment(resolved);
      }}
    />
  );
}
