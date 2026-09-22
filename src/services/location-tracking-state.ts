import type { AppStateStatus } from 'react-native';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'error';
export type LocationProviderState = 'unknown' | 'available' | 'unavailable' | 'error';
export type LocationWorkerState = 'inactive' | 'starting' | 'active' | 'unavailable' | 'error';
export type LocationTransport = 'websocket' | 'http' | 'none';
export type LocationTransportResult = 'none' | 'pending' | 'sent' | 'confirmed' | 'failed';

export interface LocationTransportAttempt {
  type: LocationTransport;
  result: LocationTransportResult;
  attemptedAt: number | null;
  error: string | null;
}

export interface LocationTrackingError {
  source: 'permission' | 'provider' | 'foreground-watcher' | 'background-service' | 'background-task' | 'position-post';
  message: string;
  occurredAt: number;
}

/** Contains diagnostic state only; it deliberately never stores coordinates. */
export interface LocationTrackingStatus {
  appState: AppStateStatus | 'unknown';
  requested: boolean;
  foregroundPermission: LocationPermissionState;
  backgroundPermission: LocationPermissionState;
  gpsProvider: LocationProviderState;
  foregroundWatcher: LocationWorkerState;
  backgroundService: LocationWorkerState;
  operationalState: 'not-tracking' | 'app-open-without-gps' | 'tracking' | 'background-tracking';
  locationCallbackCount: number;
  lastLocationCallbackAt: number | null;
  lastTransportAttempt: LocationTransportAttempt;
  lastError: LocationTrackingError | null;
}

export function transportAttemptText(attempt: LocationTransportAttempt): string {
  if (attempt.type === 'none') {
    return 'Sin intentos de transporte.';
  }

  const transportName = attempt.type === 'websocket' ? 'WebSocket' : 'POST HTTP';

  switch (attempt.result) {
    case 'pending':
      return `Enviando por ${transportName}.`;
    case 'sent':
      return 'Enviado por WebSocket; sin confirmación del servidor.';
    case 'confirmed':
      return 'POST HTTP confirmado por el servidor.';
    case 'failed':
      return `Falló el envío por ${transportName}.`;
    case 'none':
      return 'Sin resultado de transporte.';
  }
}

function hasRecordedPositionTransport(attempt: LocationTransportAttempt): boolean {
  return (
    (attempt.type === 'websocket' && attempt.result === 'sent')
    || (attempt.type === 'http' && attempt.result === 'confirmed')
  );
}

export function deriveOperationalState(
  status: Omit<LocationTrackingStatus, 'operationalState'>,
): LocationTrackingStatus['operationalState'] {
  if (!status.requested) {
    return 'not-tracking';
  }

  if (status.appState !== 'active') {
    return status.backgroundService === 'active' ? 'background-tracking' : 'not-tracking';
  }

  if (
    status.foregroundPermission !== 'granted'
    || status.gpsProvider === 'unavailable'
    || status.foregroundWatcher !== 'active'
    || !hasRecordedPositionTransport(status.lastTransportAttempt)
  ) {
    return 'app-open-without-gps';
  }

  return 'tracking';
}
