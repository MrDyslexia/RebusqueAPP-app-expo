import { startPositionTracking } from '@/services/location-tracking';
import { httpConductorApi } from '@/services/http-conductor-api';
import { ConductorApiError } from '@/services/conductor-api';
import { getSessionToken, invalidateSessionAndRedirectToLogin } from '@/services/session-token-store';

let restorationPromise: Promise<boolean> | null = null;
let startedSessionToken: string | null = null;

/**
 * Restores a persisted driver session only after the existing conductor-only
 * assignments endpoint authorizes it. The tracking start remains non-blocking
 * so a location-permission failure never prevents access to the driver
 * workspace.
 */
export function restorePersistedConductorSession(): Promise<boolean> {
  if (restorationPromise) {
    return restorationPromise;
  }

  const attempt = getSessionToken()
    .then(async (token) => {
      if (!token) {
        startedSessionToken = null;
        return false;
      }

      // The persisted token is opaque client-side data. This conductor-only
      // request is the backend authorization proof required before entering
      // the workspace or starting location tracking.
      await httpConductorApi.listAssignedShipments();

      if (startedSessionToken !== token) {
        startedSessionToken = token;
        void startPositionTracking().catch(() => {
          // Location tracking is telemetry and must never reject session restoration.
        });
      }

      return true;
    })
    .catch(async (error: unknown) => {
      startedSessionToken = null;

      if (error instanceof ConductorApiError && error.status === 401) {
        await invalidateSessionAndRedirectToLogin().catch(() => {
          // The bootstrap result remains fail-closed even if cleanup fails.
        });
      }

      return false;
    });

  restorationPromise = attempt;
  void attempt.then(() => {
    if (restorationPromise === attempt) {
      restorationPromise = null;
    }
  });

  return attempt;
}
