import { useLocalSearchParams, useRouter } from 'expo-router';

import { QrScanner, type DriverQrAction } from '@/components/qr-scanner';
import type { ShipmentId } from '@/domain/shipment';
import { getConductorApi } from '@/services/get-conductor-api';
import { resolveExpectedShipmentByQrCode, runTransitionAfterQrMatch } from '@/services/qr-resolution';

function readShipmentId(value: string | string[] | undefined): ShipmentId | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readAction(value: string | string[] | undefined): DriverQrAction {
  return value === 'withdrawal' || value === 'loading' || value === 'delivery' ? value : 'unassigned';
}

export default function QrScannerScreen() {
  const router = useRouter();
  const { action, reference, shipmentId } = useLocalSearchParams<{
    action?: string | string[];
    reference?: string | string[];
    shipmentId?: string | string[];
  }>();
  const id = readShipmentId(shipmentId);
  const label = readShipmentId(reference) ?? undefined;

  if (!id) {
    return <QrScanner action="unassigned" />;
  }

  const selectedAction = readAction(action);

  if (selectedAction === 'withdrawal' || selectedAction === 'loading') {
    // Defense-in-depth: also confirm the fresh `estado` from the resolve
    // response is still a valid source state for this action, in case the
    // on-screen state was stale.
    const validSourceStatuses = selectedAction === 'withdrawal' ? (['en_ruta'] as const) : (['asignada', 'en_sucursal'] as const);

    return (
      <QrScanner
        action={selectedAction}
        onConfirm={async (rawValue) => {
          const api = getConductorApi();

          // Resolve the scanned QR and cross-validate it identifies this
          // exact shipment before requesting any state transition — the QR
          // never changes state by itself.
          await resolveExpectedShipmentByQrCode(api, rawValue, id, validSourceStatuses);

          await runTransitionAfterQrMatch(() =>
            selectedAction === 'withdrawal' ? api.pickupShipment(id) : api.loadShipment(id),
          );

          router.replace({ pathname: '/conductor/[shipmentId]', params: { shipmentId: id } });
        }}
        shipmentId={id}
        shipmentLabel={label}
      />
    );
  }

  if (selectedAction === 'delivery') {
    return (
      <QrScanner
        action="delivery"
        onConfirm={async (rawValue) => {
          const api = getConductorApi();

          // Resolve + cross-validate now, so the delivery screen's photo/
          // submit step only unlocks once the scanned QR is proven to match
          // this shipment (replacing the previous no-op capture).
          await resolveExpectedShipmentByQrCode(api, rawValue, id, ['en_reparto']);

          router.replace({ pathname: '/conductor/[shipmentId]/delivery', params: { qrCaptured: 'true', shipmentId: id } });
        }}
        shipmentId={id}
        shipmentLabel={label}
      />
    );
  }

  return <QrScanner action="unassigned" shipmentId={id} shipmentLabel={label} />;
}
