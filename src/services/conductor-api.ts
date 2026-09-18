import type { AssignedShipment, ShipmentId } from '@/domain/shipment';

export interface DailyShipmentSummary {
  asignadasHoy: number | null;
  entregadasHoy: number | null;
  pendientes: {
    total: number | null;
    porEstado: {
      asignada: number | null;
      en_ruta: number | null;
      retirado: number | null;
      en_reparto: number | null;
    };
  };
}

/**
 * Boundary for the backend integration, matching the real `m4.blocktype.cl`
 * contract for the conductor role (GET /encomiendas, GET /encomiendas/:id,
 * POST /encomiendas/:id/{recoger,cargar,entregar,reportar-fallida}).
 *
 * Out of scope by design (executive/administrator only, not implemented
 * here): assign, decide-after-pickup, cancel, change payment, and
 * user/branch/shift management.
 */
export interface ConductorApi {
  listAssignedShipments(): Promise<readonly AssignedShipment[]>;
  /** `GET /encomiendas/resumen-diario` — server-calculated driver daily summary. */
  getDailyShipmentSummary(): Promise<DailyShipmentSummary>;
  getAssignedShipment(shipmentId: ShipmentId): Promise<AssignedShipment | null>;
  /**
   * `GET /encomiendas/qr/:codigoQr` — resolves an opaque, raw scanned QR
   * value to the encomienda it identifies. Per the QR contract this NEVER
   * changes state by itself: the caller must cross-validate the returned
   * `id` (and, defensively, `status`) against the shipment expected on
   * screen before invoking any transition endpoint. For a conductor, a QR
   * that does not exist or belongs to an encomienda not visible to them
   * both surface as a `404` with no data revealed.
   */
  resolveShipmentByQrCode(codigoQr: string): Promise<AssignedShipment>;
  /** `POST /encomiendas/:id/recoger` — real transition: en_ruta → retirado. */
  pickupShipment(shipmentId: ShipmentId): Promise<AssignedShipment>;
  /** `POST /encomiendas/:id/cargar` — real transition: asignada/en_sucursal → en_reparto. */
  loadShipment(shipmentId: ShipmentId): Promise<AssignedShipment>;
  /** `POST /encomiendas/:id/entregar` — real transition: en_reparto → entregada. */
  deliverShipment(shipmentId: ShipmentId, photoBase64?: string): Promise<AssignedShipment>;
  /**
   * `POST /encomiendas/:id/reportar-fallida` — real transition: en_reparto → fallida
   * (or → finalizada automatically once `intentosFallidos` reaches 3).
   */
  reportFailedDelivery(shipmentId: ShipmentId, motivo: string, photoBase64?: string): Promise<AssignedShipment>;
  /**
   * `GET /encomiendas/:id/foto-entrega` — fetches the real delivery photo
   * (binary `image/jpeg`, not JSON) and returns it as a
   * `data:image/jpeg;base64,...` URI ready for a React Native `<Image>`
   * source. Resolves to `null` when the backend reports `404` (no photo
   * saved for this shipment) instead of throwing, since that is an
   * expected, non-error outcome per the QR contract.
   */
  getDeliveryPhotoUri(shipmentId: ShipmentId): Promise<string | null>;
  /**
   * `GET /encomiendas/:id/foto-entrega-fallida` — fetches the most recent
   * failed-delivery report photo (binary `image/jpeg`, not JSON), the
   * backend-authenticated counterpart of `foto-entrega` for
   * `reportar-fallida`. Same shape and `null`-on-404 contract as
   * {@link getDeliveryPhotoUri}.
   */
  getFailureReportPhotoUri(shipmentId: ShipmentId): Promise<string | null>;
}

/** Thrown when there is no session token available to authenticate a request. */
export class SessionUnavailableError extends Error {
  constructor() {
    super('La sesión no está disponible. Inicia sesión nuevamente.');
    this.name = 'SessionUnavailableError';
  }
}

/**
 * Thrown for any backend or connectivity failure, carrying a message safe to
 * display as-is. `status` is the HTTP status code when the failure came from
 * a real response (undefined for network/config/contract failures before a
 * response was received), so callers can branch on the QR error table from
 * `Flujo QR Conductores.md` (401/403/404/409/400) instead of only showing a
 * generic message.
 */
export class ConductorApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ConductorApiError';
    this.status = status;
  }
}
