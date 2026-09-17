import type { AssignedShipment, ShipmentId, ShipmentStatus } from '@/domain/shipment';
import { fixtureAssignedShipments } from '@/fixtures/assigned-shipments';
import { ConductorApiError, type ConductorApi } from '@/services/conductor-api';

let fixtureShipments: AssignedShipment[] = fixtureAssignedShipments.map((shipment) => ({ ...shipment }));

function findShipmentOrThrow(shipmentId: ShipmentId): AssignedShipment {
  const shipment = fixtureShipments.find((item) => item.id === shipmentId);

  if (!shipment) {
    throw new ConductorApiError('No se encontró la encomienda de prueba solicitada.');
  }

  return shipment;
}

function replaceShipment(updated: AssignedShipment): AssignedShipment {
  fixtureShipments = fixtureShipments.map((item) => (item.id === updated.id ? updated : item));

  return updated;
}

function applyTransition(
  shipmentId: ShipmentId,
  expectedStatuses: readonly ShipmentStatus[],
  nextStatus: ShipmentStatus,
  invalidStateMessage: string,
): AssignedShipment {
  const shipment = findShipmentOrThrow(shipmentId);

  if (!expectedStatuses.includes(shipment.status)) {
    throw new ConductorApiError(invalidStateMessage);
  }

  return replaceShipment({ ...shipment, status: nextStatus });
}

/**
 * Development-only navigation fixture. It mirrors the real backend state
 * machine locally in memory (never over the network) so the driver flow can
 * be exercised end to end without a live `m4.blocktype.cl` session.
 */
export const fixtureConductorApi: ConductorApi = {
  async listAssignedShipments() {
    return fixtureShipments;
  },

  async getAssignedShipment(shipmentId) {
    return fixtureShipments.find((shipment) => shipment.id === shipmentId) ?? null;
  },

  async resolveShipmentByQrCode(codigoQr) {
    // Fixtures have no real `codigoQr` value; for local development the
    // scanned text is treated as the shipment id directly so the resolve +
    // cross-validation flow can be exercised end to end without a backend.
    const shipment = fixtureShipments.find((item) => item.id === codigoQr.trim());

    if (!shipment) {
      throw new ConductorApiError('La etiqueta QR no está disponible.', 404);
    }

    return shipment;
  },

  async pickupShipment(shipmentId) {
    return applyTransition(
      shipmentId,
      ['en_ruta'],
      'retirado',
      'La encomienda de prueba no está en estado "en ruta" para confirmar el retiro.',
    );
  },

  async loadShipment(shipmentId) {
    return applyTransition(
      shipmentId,
      ['asignada', 'en_sucursal'],
      'en_reparto',
      'La encomienda de prueba no está lista para cargar (debe estar asignada o en sucursal).',
    );
  },

  async deliverShipment(shipmentId, _photoBase64) {
    const delivered = applyTransition(
      shipmentId,
      ['en_reparto'],
      'entregada',
      'La encomienda de prueba no está en reparto para confirmar la entrega.',
    );

    return replaceShipment({ ...delivered, hasDeliveryPhoto: true });
  },

  async reportFailedDelivery(shipmentId, motivo, _photoBase64) {
    if (!motivo.trim()) {
      throw new ConductorApiError('El motivo de la falla de entrega es obligatorio.');
    }

    const shipment = findShipmentOrThrow(shipmentId);

    if (shipment.status !== 'en_reparto') {
      throw new ConductorApiError('La encomienda de prueba no está en reparto para reportar una falla.');
    }

    const failedAttempts = shipment.failedAttempts + 1;
    const status: ShipmentStatus = failedAttempts >= 3 ? 'finalizada' : 'fallida';

    return replaceShipment({ ...shipment, failedAttempts, status });
  },

  async getDeliveryPhotoUri(_shipmentId) {
    // No canned photo asset exists for fixtures; matches the real backend's
    // "no photo saved" outcome (404 → null) instead of faking an image.
    return null;
  },
};
