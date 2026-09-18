export type ShipmentId = string;

export type ShipmentStatus =
  | 'procesando'
  | 'asignada'
  | 'en_ruta'
  | 'retirado'
  | 'en_sucursal'
  | 'en_reparto'
  | 'entregada'
  | 'fallida'
  | 'finalizada';

/**
 * Raw "encomienda" shape returned by the backend on list, detail, and every
 * state-transition endpoint (`GET /encomiendas`, `GET /encomiendas/:id`,
 * `POST /encomiendas/:id/{recoger,cargar,entregar,reportar-fallida}`).
 *
 * There is intentionally no readable branch/shift name in this shape — only
 * optional numeric ids (`sucursalOrigenId`, `sucursalDestinoId`). The UI must
 * never invent an "assignment label" from those ids.
 *
 * `tipoDocumento`, `formaPago`, and `estadoPago` are kept as `string` because
 * the backend contract only confirms sample values ("factura",
 * "transferencia", "por_pagar") and not the full enum.
 */
export interface Encomienda {
  id: number;
  numeroSeguimiento: string;
  codigoQr: string;
  remitenteId: number;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  destinatarioRut: string | null;
  direccionEnvio: string;
  direccionRetiro: string | null;
  sucursalOrigenId: number | null;
  sucursalDestinoId: number | null;
  estado: ShipmentStatus;
  conductorAsignadoId: number | null;
  intentosFallidos: number;
  /** Postgres `numeric` serialized as a string, e.g. "15000.00". */
  totalAPagar: string;
  tipoDocumento: string;
  formaPago: string;
  estadoPago: string;
  creadoPor: number;
  createdAt: string;
  updatedAt: string;
  tieneFotoEntrega: boolean;
}

/**
 * Today the backend assigns small sequential integer ids (Postgres serial),
 * so a lossless `number <-> string` conversion is safe. Revisit these
 * helpers if the backend ever migrates `encomiendas.id` to `bigint` values
 * exceeding `Number.MAX_SAFE_INTEGER` or to a non-numeric id (e.g. UUID).
 */
export function apiIdToShipmentId(apiId: number): ShipmentId {
  return String(apiId);
}

export function shipmentIdToApiId(shipmentId: ShipmentId): number {
  const apiId = Number(shipmentId);

  if (!Number.isSafeInteger(apiId) || apiId <= 0) {
    throw new Error(`El identificador de encomienda "${shipmentId}" no es válido.`);
  }

  return apiId;
}

/**
 * Frontend read model derived from `Encomienda`. Only fields backed by the
 * real contract are exposed — no fabricated branch/shift assignment label.
 */
export interface AssignedShipment {
  id: ShipmentId;
  reference: string;
  /** Raw creation date supplied by the backend for inbox date ordering. */
  createdAt: string;
  recipientName: string;
  deliveryAddress: string;
  pickupAddress: string | null;
  status: ShipmentStatus;
  /** Kept as the raw backend string; render it with a currency prefix as-is. */
  totalToPay: string;
  hasDeliveryPhoto: boolean;
  failedAttempts: number;
}

export function toAssignedShipment(encomienda: Encomienda): AssignedShipment {
  return {
    id: apiIdToShipmentId(encomienda.id),
    reference: encomienda.numeroSeguimiento,
    createdAt: encomienda.createdAt,
    recipientName: encomienda.destinatarioNombre,
    deliveryAddress: encomienda.direccionEnvio,
    pickupAddress: encomienda.direccionRetiro,
    status: encomienda.estado,
    totalToPay: encomienda.totalAPagar,
    hasDeliveryPhoto: encomienda.tieneFotoEntrega,
    failedAttempts: encomienda.intentosFallidos,
  };
}

export interface QrAction {
  action: 'withdrawal' | 'loading';
  label: string;
}

/**
 * Maps a shipment's current `status` onto the single QR-driven action a
 * driver may take next (if any). Shared between the shipment detail screen
 * (which renders the action button) and the standalone home QR scanner
 * (which, once it has already resolved+identified the shipment from a
 * single scan, executes this same action directly instead of demanding a
 * second scan).
 */
export function getQrAction(status?: ShipmentStatus): QrAction | null {
  if (status === 'en_ruta') {
    return { action: 'withdrawal', label: 'Confirmar retiro con QR' };
  }

  if (status === 'asignada' || status === 'en_sucursal') {
    return { action: 'loading', label: 'Confirmar carga con QR' };
  }

  return null;
}
