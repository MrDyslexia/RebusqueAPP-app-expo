import type { AssignedShipment, ShipmentStatus } from '@/domain/shipment';

export type ShipmentStatusFilter = ShipmentStatus | 'all';
export type ShipmentDateOrder = 'newest' | 'oldest';

export function getAvailableShipmentStatuses(shipments: readonly AssignedShipment[]): ShipmentStatus[] {
  return [...new Set(shipments.map((shipment) => shipment.status))];
}

export function filterAndSortShipments(
  shipments: readonly AssignedShipment[],
  searchTerm: string,
  statusFilter: ShipmentStatusFilter,
  dateOrder: ShipmentDateOrder,
): AssignedShipment[] {
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

  return shipments
    .filter((shipment) => (
      shipment.id.toLocaleLowerCase().includes(normalizedSearchTerm)
      && (statusFilter === 'all' || shipment.status === statusFilter)
    ))
    .sort((left, right) => {
      const leftTimestamp = Date.parse(left.createdAt);
      const rightTimestamp = Date.parse(right.createdAt);

      if (Number.isNaN(leftTimestamp) || Number.isNaN(rightTimestamp)) {
        return 0;
      }

      return dateOrder === 'newest'
        ? rightTimestamp - leftTimestamp
        : leftTimestamp - rightTimestamp;
    });
}
