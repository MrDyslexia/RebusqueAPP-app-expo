import type { AppStateStatus } from 'react-native';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'error';
export type LocationProviderState = 'unknown' | 'available' | 'unavailable' | 'error';
export type LocationWorkerState = 'inactive' | 'starting' | 'active' | 'unavailable' | 'error';

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
  lastSuccessfulPostAt: number | null;
  lastError: LocationTrackingError | null;
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
    || status.lastSuccessfulPostAt === null
  ) {
    return 'app-open-without-gps';
  }

  return 'tracking';
}
