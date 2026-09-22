import { describe, expect, test } from 'bun:test';

import {
  deriveOperationalState,
  transportAttemptText,
  type LocationTrackingStatus,
} from './location-tracking-state';

const baseStatus: Omit<LocationTrackingStatus, 'operationalState'> = {
  appState: 'active',
  requested: true,
  foregroundPermission: 'granted',
  backgroundPermission: 'denied',
  gpsProvider: 'available',
  foregroundWatcher: 'active',
  backgroundService: 'inactive',
  locationCallbackCount: 1,
  lastLocationCallbackAt: 1,
  lastTransportAttempt: {
    type: 'http',
    result: 'confirmed',
    attemptedAt: 1,
    error: null,
  },
  lastError: null,
};

describe('deriveOperationalState', () => {
  test('distinguishes an open app without a recorded location transport', () => {
    expect(deriveOperationalState({
      ...baseStatus,
      lastTransportAttempt: { type: 'none', result: 'none', attemptedAt: null, error: null },
    })).toBe('app-open-without-gps');
  });

  test('marks the active foreground watcher as tracking after a confirmed HTTP position POST', () => {
    expect(deriveOperationalState(baseStatus)).toBe('tracking');
  });

  test('reports background tracking only when the service remains active', () => {
    expect(deriveOperationalState({ ...baseStatus, appState: 'background', backgroundService: 'active' })).toBe('background-tracking');
    expect(deriveOperationalState({ ...baseStatus, appState: 'background' })).toBe('not-tracking');
  });

  test('does not describe a WebSocket send as a confirmed POST', () => {
    expect(transportAttemptText({
      type: 'websocket',
      result: 'sent',
      attemptedAt: 1,
      error: null,
    })).toBe('Enviado por WebSocket; sin confirmación del servidor.');
  });
});
