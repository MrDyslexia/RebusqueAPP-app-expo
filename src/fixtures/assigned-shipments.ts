import type { AssignedShipment } from '@/domain/shipment';

export const fixtureAssignedShipments: readonly AssignedShipment[] = [
  {
    id: '9001',
    reference: 'RBQ-24001',
    createdAt: '2026-09-16T14:30:00.000Z',
    recipientName: 'Avery Morgan',
    deliveryAddress: 'Recepción zona norte, Providencia',
    pickupAddress: 'Bodega central, Maipú',
    status: 'en_ruta',
    totalToPay: '15000.00',
    hasDeliveryPhoto: false,
    failedAttempts: 0,
  },
  {
    id: '9002',
    reference: 'RBQ-24002',
    createdAt: '2026-09-17T09:15:00.000Z',
    recipientName: 'Jordan Lee',
    deliveryAddress: 'Oficina ribereña, Valparaíso',
    pickupAddress: 'Punto de retiro del puerto, Valparaíso',
    status: 'en_reparto',
    totalToPay: '8500.00',
    hasDeliveryPhoto: false,
    failedAttempts: 0,
  },
];
