import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { ConductorApiError } from '@/services/conductor-api';

let storedToken: string | null = null;
let validationError: unknown = null;

const getSessionToken = mock(async () => storedToken);
const invalidateSessionAndRedirectToLogin = mock(async () => undefined);
const startPositionTracking = mock(async () => undefined);
const listAssignedShipments = mock(async () => {
  if (validationError) {
    throw validationError;
  }

  return [];
});

mock.module('@/services/session-token-store', () => ({
  getSessionToken,
  invalidateSessionAndRedirectToLogin,
}));
mock.module('@/services/location-tracking', () => ({ startPositionTracking }));
mock.module('@/services/http-conductor-api', () => ({
  httpConductorApi: { listAssignedShipments },
}));

const { restorePersistedConductorSession } = await import('./session-bootstrap');

beforeEach(async () => {
  storedToken = null;
  validationError = null;
  await restorePersistedConductorSession();
  getSessionToken.mockClear();
  invalidateSessionAndRedirectToLogin.mockClear();
  startPositionTracking.mockClear();
  listAssignedShipments.mockClear();
});

describe('restorePersistedConductorSession', () => {
  test('does not restore, validate, or start tracking without a stored token', async () => {
    await expect(restorePersistedConductorSession()).resolves.toBe(false);

    expect(listAssignedShipments).not.toHaveBeenCalled();
    expect(startPositionTracking).not.toHaveBeenCalled();
    expect(invalidateSessionAndRedirectToLogin).not.toHaveBeenCalled();
  });

  test('fails closed and preserves the existing invalid-session cleanup for a corrupt or unauthorized token', async () => {
    storedToken = 'corrupt-or-expired-token';
    validationError = new ConductorApiError('Unauthorized', 401);

    await expect(restorePersistedConductorSession()).resolves.toBe(false);

    expect(listAssignedShipments).toHaveBeenCalledTimes(1);
    expect(startPositionTracking).not.toHaveBeenCalled();
    expect(invalidateSessionAndRedirectToLogin).toHaveBeenCalledTimes(1);
  });

  test('does not enter the conductor flow for a valid session without conductor authorization', async () => {
    storedToken = 'non-conductor-token';
    validationError = new ConductorApiError('Forbidden', 403);

    await expect(restorePersistedConductorSession()).resolves.toBe(false);

    expect(listAssignedShipments).toHaveBeenCalledTimes(1);
    expect(startPositionTracking).not.toHaveBeenCalled();
    expect(invalidateSessionAndRedirectToLogin).not.toHaveBeenCalled();
  });

  test('fails closed without tracking when conductor validation has a network error', async () => {
    storedToken = 'network-failure-token';
    validationError = new Error('Network unavailable');

    await expect(restorePersistedConductorSession()).resolves.toBe(false);

    expect(listAssignedShipments).toHaveBeenCalledTimes(1);
    expect(startPositionTracking).not.toHaveBeenCalled();
    expect(invalidateSessionAndRedirectToLogin).not.toHaveBeenCalled();
  });

  test('restores a backend-authorized conductor session and starts tracking exactly once', async () => {
    storedToken = 'persisted-conductor-token';

    await expect(Promise.all([
      restorePersistedConductorSession(),
      restorePersistedConductorSession(),
    ])).resolves.toEqual([true, true]);

    expect(getSessionToken).toHaveBeenCalledTimes(1);
    expect(listAssignedShipments).toHaveBeenCalledTimes(1);
    expect(startPositionTracking).toHaveBeenCalledTimes(1);

    await expect(restorePersistedConductorSession()).resolves.toBe(true);
    expect(listAssignedShipments).toHaveBeenCalledTimes(2);
    expect(startPositionTracking).toHaveBeenCalledTimes(1);
  });
});
