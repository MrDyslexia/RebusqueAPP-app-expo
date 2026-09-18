import { describe, expect, test } from 'bun:test';

import type { AssignedShipment } from '@/domain/shipment';
import { filterAndSortShipments, getAvailableShipmentStatuses } from './shipment-inbox';

const shipments: readonly AssignedShipment[] = [
  {
    id: '1001',
    reference: 'RBQ-1001',
    createdAt: '2026-09-15T09:00:00.000Z',
    recipientName: 'Andrea Silva',
    deliveryAddress: 'Av. Central 100',
    pickupAddress: null,
    status: 'en_ruta',
    totalToPay: '5000.00',
    hasDeliveryPhoto: false,
    failedAttempts: 0,
  },
  {
    id: '2002',
    reference: 'RBQ-2002',
    createdAt: '2026-09-17T12:00:00.000Z',
    recipientName: 'Bruno Torres',
    deliveryAddress: 'Calle Norte 200',
    pickupAddress: null,
    status: 'entregada',
    totalToPay: '7500.00',
    hasDeliveryPhoto: true,
    failedAttempts: 0,
  },
  {
    id: '3003',
    reference: 'RBQ-3003',
    createdAt: '2026-09-16T16:00:00.000Z',
    recipientName: 'Carla Soto',
    deliveryAddress: 'Pasaje Sur 300',
    pickupAddress: null,
    status: 'en_ruta',
    totalToPay: '10000.00',
    hasDeliveryPhoto: false,
    failedAttempts: 0,
  },
];

describe('filterAndSortShipments', () => {
  test('derives filter options exclusively from statuses in the assigned list', () => {
    expect(getAvailableShipmentStatuses(shipments)).toEqual(['en_ruta', 'entregada']);
  });

  test('combines ID search, status filtering, and newest-first date ordering', () => {
    expect(filterAndSortShipments(shipments, '00', 'en_ruta', 'newest').map(({ id }) => id)).toEqual(['3003', '1001']);
  });

  test('returns oldest first when requested', () => {
    expect(filterAndSortShipments(shipments, '', 'all', 'oldest').map(({ id }) => id)).toEqual(['1001', '3003', '2002']);
  });
});
