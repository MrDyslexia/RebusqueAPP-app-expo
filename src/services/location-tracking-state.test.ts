import { describe, expect, test } from 'bun:test';

import { deriveOperationalState, type LocationTrackingStatus } from './location-tracking-state';

const baseStatus: Omit<LocationTrackingStatus, 'operationalState'> = {
  appState: 'active',
  requested: true,
  foregroundPermission: 'granted',
  backgroundPermission: 'denied',
  gpsProvider: 'available',
  foregroundWatcher: 'active',
  backgroundService: 'inactive',
  lastSuccessfulPostAt: 1,
  lastError: null,
};

describe('deriveOperationalState', () => {
  test('distinguishes an open app without a successful GPS POST', () => {
    expect(deriveOperationalState({ ...baseStatus, lastSuccessfulPostAt: null })).toBe('app-open-without-gps');
  });

  test('marks the active foreground watcher as tracking after a successful POST', () => {
    expect(deriveOperationalState(baseStatus)).toBe('tracking');
  });

  test('reports background tracking only when the service remains active', () => {
    expect(deriveOperationalState({ ...baseStatus, appState: 'background', backgroundService: 'active' })).toBe('background-tracking');
    expect(deriveOperationalState({ ...baseStatus, appState: 'background' })).toBe('not-tracking');
  });
});
