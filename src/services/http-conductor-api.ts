import { shipmentIdToApiId, toAssignedShipment, type Encomienda } from '@/domain/shipment';
import { ConductorApiError, type ConductorApi } from '@/services/conductor-api';
import { conductorApiRequest, getApiBaseUrl, getAuthorizationHeader } from '@/services/conductor-http-client';

interface EncomiendaEnvelope {
  encomienda: Encomienda;
}

interface EncomiendaListEnvelope {
  encomiendas: Encomienda[];
}

/**
 * Real backend integration for the conductor role against
 * `https://m4.blocktype.cl`. See `conductor-api.ts` for the documented
 * endpoint mapping and the transitions each method triggers.
 */
export const httpConductorApi: ConductorApi = {
  async listAssignedShipments() {
    // The backend already filters by `conductorAsignadoId = tu_id` server-side
    // for the conductor role; no query params are sent here.
    const { encomiendas } = await conductorApiRequest<EncomiendaListEnvelope>('/encomiendas');

    return encomiendas.map(toAssignedShipment);
  },

  async getAssignedShipment(shipmentId) {
    const apiId = shipmentIdToApiId(shipmentId);
    const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(`/encomiendas/${apiId}`);

    return toAssignedShipment(encomienda);
  },

  async resolveShipmentByQrCode(codigoQr) {
    try {
      // `codigoQr` is opaque text: it is only URL-encoded and forwarded as-is,
      // never parsed or derived from client-side.
      const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(
        `/encomiendas/qr/${encodeURIComponent(codigoQr)}`,
      );

      return toAssignedShipment(encomienda);
    } catch (error) {
      if (error instanceof ConductorApiError && error.status === 404) {
        // Per contract: never reveal whether the label exists or leak any
        // encomienda data on a 404 — override whatever the backend sent.
        throw new ConductorApiError('La etiqueta QR no está disponible.', 404);
      }

      throw error;
    }
  },

  async pickupShipment(shipmentId) {
    const apiId = shipmentIdToApiId(shipmentId);
    const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(`/encomiendas/${apiId}/recoger`, {
      method: 'POST',
    });

    return toAssignedShipment(encomienda);
  },

  async loadShipment(shipmentId) {
    const apiId = shipmentIdToApiId(shipmentId);
    const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(`/encomiendas/${apiId}/cargar`, {
      method: 'POST',
    });

    return toAssignedShipment(encomienda);
  },

  async deliverShipment(shipmentId, photoBase64) {
    const apiId = shipmentIdToApiId(shipmentId);
    const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(`/encomiendas/${apiId}/entregar`, {
      method: 'POST',
      body: photoBase64 ? { fotoEntregaBase64: photoBase64 } : {},
    });

    return toAssignedShipment(encomienda);
  },

  async reportFailedDelivery(shipmentId, motivo, photoBase64) {
    const apiId = shipmentIdToApiId(shipmentId);
    const { encomienda } = await conductorApiRequest<EncomiendaEnvelope>(`/encomiendas/${apiId}/reportar-fallida`, {
      method: 'POST',
      body: photoBase64 ? { motivo, fotoReporteBase64: photoBase64 } : { motivo },
    });

    return toAssignedShipment(encomienda);
  },

  async getDeliveryPhotoUri(shipmentId) {
    const apiId = shipmentIdToApiId(shipmentId);
    const authorization = await getAuthorizationHeader();
    const requestUrl = new URL(`/encomiendas/${apiId}/foto-entrega`, getApiBaseUrl());

    let response: Response;

    try {
      response = await fetch(requestUrl, { headers: { Authorization: authorization } });
    } catch {
      throw new ConductorApiError('No fue posible conectar con el backend de RebusqueAPP.');
    }

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }

      throw new ConductorApiError('No se pudo obtener la foto de entrega.', response.status);
    }

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new ConductorApiError('No se pudo procesar la foto de entrega recibida.'));
        }
      };
      reader.onerror = () => reject(new ConductorApiError('No se pudo procesar la foto de entrega recibida.'));
      reader.readAsDataURL(blob);
    });
  },
};
