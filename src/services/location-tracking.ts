import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { ConductorApiError } from '@/services/conductor-api';
import { getConductorApi } from '@/services/get-conductor-api';
import {
  deriveOperationalState,
  type LocationTrackingError,
  type LocationTrackingStatus,
} from '@/services/location-tracking-state';
import { invalidateSessionAndRedirectToLogin } from '@/services/session-token-store';

export type { LocationTrackingError, LocationTrackingStatus } from '@/services/location-tracking-state';

/**
 * DEP-002 — real-time driver position tracking. The foreground watcher runs
 * only while the application is active and the background task is registered
 * while it is active, as required by Expo SDK 57 and Android foreground
 * service restrictions. Location telemetry never gates the driver's login.
 */
const LOCATION_TASK_NAME = 'rebusqueapp-conductor-position-tracking';

type TrackingStatusListener = () => void;

let foregroundWatchSubscription: Location.LocationSubscription | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let trackingRequested = false;
let startTrackingPromise: Promise<void> | null = null;
let startForegroundWatchPromise: Promise<void> | null = null;
let startBackgroundServicePromise: Promise<void> | null = null;
// Incremented only when a foreground watch is explicitly invalidated. A start()
// attempt captures the generation before awaiting the native call; if it changed
// by the time it resolves, that attempt is stale and must not restore a removed
// subscription or mark the JS state "active" again.
let foregroundWatchGeneration = 0;
const statusListeners = new Set<TrackingStatusListener>();

let trackingStatus: LocationTrackingStatus = {
  appState: AppState.currentState ?? 'unknown',
  requested: false,
  foregroundPermission: 'unknown',
  backgroundPermission: 'unknown',
  gpsProvider: 'unknown',
  foregroundWatcher: 'inactive',
  backgroundService: 'inactive',
  operationalState: 'not-tracking',
  lastSuccessfulPostAt: null,
  lastError: null,
};

export function getLocationTrackingStatus(): LocationTrackingStatus {
  return trackingStatus;
}

export function subscribeToLocationTrackingStatus(listener: TrackingStatusListener): () => void {
  statusListeners.add(listener);

  return () => statusListeners.delete(listener);
}

function updateTrackingStatus(changes: Partial<Omit<LocationTrackingStatus, 'operationalState'>>): void {
  const next = { ...trackingStatus, ...changes };
  trackingStatus = { ...next, operationalState: deriveOperationalState(next) };
  statusListeners.forEach((listener) => listener());
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function recordError(source: LocationTrackingError['source'], error: unknown, fallback: string): void {
  updateTrackingStatus({
    lastError: {
      source,
      message: errorMessage(error, fallback),
      occurredAt: Date.now(),
    },
  });
}

async function refreshProviderStatus(): Promise<void> {
  try {
    const providerStatus = await Location.getProviderStatusAsync();
    const isAvailable = providerStatus.locationServicesEnabled && (providerStatus.gpsAvailable ?? true);
    updateTrackingStatus({ gpsProvider: isAvailable ? 'available' : 'unavailable' });
  } catch (error) {
    updateTrackingStatus({ gpsProvider: 'error' });
    recordError('provider', error, 'No se pudo consultar la disponibilidad del proveedor GPS.');
  }
}

async function sendPosition(coords: { latitude: number; longitude: number }): Promise<void> {
  try {
    // The published request contract stays unchanged: only the two coordinates
    // are sent and a resolved request means the backend accepted its 201 response.
    await getConductorApi().reportPosition({ latitud: coords.latitude, longitud: coords.longitude });
    updateTrackingStatus({ lastSuccessfulPostAt: Date.now() });
  } catch (error) {
    if (error instanceof ConductorApiError) {
      if (error.status === 401) {
        recordError('position-post', error, 'La sesión ya no es válida para enviar ubicación.');
        await stopPositionTracking();
        await invalidateSessionAndRedirectToLogin();
        return;
      }

      if (error.status === 429) {
        // The backend rate limit is expected for overlapping native updates.
        return;
      }

      recordError('position-post', error, 'No se pudo enviar la ubicación del conductor.');
      console.warn('[location-tracking] No se pudo enviar la posición del conductor.', error.message);
      return;
    }

    recordError('position-post', error, 'Error inesperado al enviar la ubicación del conductor.');
    console.warn('[location-tracking] Error inesperado al enviar la posición del conductor.', error);
  }
}

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      recordError('background-task', error, 'La tarea de ubicación en segundo plano falló.');
      console.warn('[location-tracking] Falla en la tarea de ubicación en segundo plano.', error.message);
      return;
    }

    for (const location of data?.locations ?? []) {
      await sendPosition(location.coords);
    }
  },
);

async function startForegroundWatch(): Promise<void> {
  if (foregroundWatchSubscription || !trackingRequested || AppState.currentState !== 'active') {
    return;
  }

  if (startForegroundWatchPromise) {
    return startForegroundWatchPromise;
  }

  const generation = ++foregroundWatchGeneration;
  updateTrackingStatus({ foregroundWatcher: 'starting' });

  const attempt = (async () => {
    await refreshProviderStatus();

    try {
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 1000, distanceInterval: 0 },
        (location) => {
          if (generation !== foregroundWatchGeneration) {
            // A stop() ran after this watcher was superseded; ignore late
            // native callbacks from the now-orphaned subscription.
            return;
          }
          void sendPosition(location.coords);
        },
        (reason) => {
          if (generation !== foregroundWatchGeneration) {
            return;
          }
          foregroundWatchSubscription?.remove();
          foregroundWatchSubscription = null;
          updateTrackingStatus({ foregroundWatcher: 'error' });
          recordError('foreground-watcher', new Error(reason), 'El watcher de ubicación en primer plano falló.');
        },
      );

      if (generation !== foregroundWatchGeneration) {
        // stopForegroundWatch() (or a newer start) ran while
        // watchPositionAsync() was resolving. Remove the now-orphaned native
        // subscription immediately: JS state must never say "active" without
        // a matching live native listener.
        subscription.remove();
        return;
      }

      if (trackingRequested) {
        foregroundWatchSubscription = subscription;
        updateTrackingStatus({ foregroundWatcher: 'active' });
      } else {
        subscription.remove();
        updateTrackingStatus({ foregroundWatcher: 'inactive' });
      }
    } catch (error) {
      if (generation !== foregroundWatchGeneration) {
        return;
      }
      foregroundWatchSubscription = null;
      updateTrackingStatus({ foregroundWatcher: 'error' });
      recordError('foreground-watcher', error, 'No se pudo iniciar el watcher de ubicación en primer plano.');
      console.warn('[location-tracking] No se pudo iniciar el watcher de ubicación en primer plano.', error);
    }
  })();

  startForegroundWatchPromise = attempt;

  try {
    await attempt;
  } finally {
    // Only clear the shared reference if it still points at this attempt.
    // A stop() -> start() cycle may have already replaced it with a newer
    // in-flight attempt, and this stale finally must not null that out.
    if (startForegroundWatchPromise === attempt) {
      startForegroundWatchPromise = null;
    }
  }
}

function stopForegroundWatch(): void {
  // Bump the generation first so any in-flight start() attempt can never
  // resurrect a subscription or mark the state "active" after this stop,
  // and drop the shared promise reference so the next start() begins a
  // fresh attempt instead of piggybacking on the now-invalidated one.
  foregroundWatchGeneration += 1;
  startForegroundWatchPromise = null;
  foregroundWatchSubscription?.remove();
  foregroundWatchSubscription = null;
  updateTrackingStatus({ foregroundWatcher: 'inactive' });
}

async function startBackgroundUpdates(): Promise<void> {
  if (!trackingRequested || AppState.currentState !== 'active') {
    return;
  }

  if (startBackgroundServicePromise) {
    return startBackgroundServicePromise;
  }

  updateTrackingStatus({ backgroundService: 'starting' });
  startBackgroundServicePromise = (async () => {
    try {
      if (!await TaskManager.isAvailableAsync()) {
        updateTrackingStatus({ backgroundService: 'unavailable' });
        return;
      }

      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
        updateTrackingStatus({ backgroundService: 'active' });
        return;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: 'RebusqueAPP',
          notificationBody: 'Compartiendo tu ubicación mientras tienes sesión activa.',
        },
        pausesUpdatesAutomatically: false,
      });

      if (!trackingRequested) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        updateTrackingStatus({ backgroundService: 'inactive' });
        return;
      }

      updateTrackingStatus({ backgroundService: 'active' });
    } catch (error) {
      updateTrackingStatus({ backgroundService: 'error' });
      recordError('background-service', error, 'No se pudo iniciar el seguimiento en segundo plano.');
      console.warn('[location-tracking] No se pudo iniciar el seguimiento en segundo plano.', error);
    }
  })();

  try {
    await startBackgroundServicePromise;
  } finally {
    startBackgroundServicePromise = null;
  }
}

async function stopBackgroundUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    updateTrackingStatus({ backgroundService: 'inactive' });
  } catch (error) {
    updateTrackingStatus({ backgroundService: 'error' });
    recordError('background-service', error, 'No se pudo detener el seguimiento en segundo plano.');
    console.warn('[location-tracking] No se pudo detener el seguimiento en segundo plano.', error);
  }
}

async function resumeForegroundTracking(): Promise<void> {
  if (!trackingRequested || AppState.currentState !== 'active') {
    return;
  }

  try {
    const foregroundPermission = await Location.getForegroundPermissionsAsync();
    const hasForegroundPermission = foregroundPermission.status === 'granted';
    updateTrackingStatus({ foregroundPermission: hasForegroundPermission ? 'granted' : 'denied' });

    if (!hasForegroundPermission) {
      return;
    }

    // Expo preserves a live foreground subscription across AppState changes.
    // When it already exists, refresh the provider diagnostic here because
    // startForegroundWatch() correctly avoids creating a duplicate watcher.
    if (foregroundWatchSubscription) {
      await refreshProviderStatus();
    }

    await startForegroundWatch();

    const backgroundPermission = await Location.getBackgroundPermissionsAsync();
    const hasBackgroundPermission = backgroundPermission.status === 'granted';
    updateTrackingStatus({ backgroundPermission: hasBackgroundPermission ? 'granted' : 'denied' });

    if (hasBackgroundPermission) {
      await startBackgroundUpdates();
    }
  } catch (error) {
    updateTrackingStatus({ foregroundPermission: 'error' });
    recordError('permission', error, 'No se pudo revalidar el permiso de ubicación al volver a la aplicación.');
    console.warn('[location-tracking] No se pudo reanudar el seguimiento en primer plano.', error);
  }
}

function handleAppStateChange(nextState: AppStateStatus): void {
  updateTrackingStatus({ appState: nextState });

  if (nextState === 'active') {
    void resumeForegroundTracking();
  }
}

function registerAppStateListener(): void {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }
}

/**
 * Starts driver location telemetry after login without blocking navigation.
 * A failed foreground watcher never leaves the session marked as active: the
 * AppState listener remains registered and retries after the app returns to
 * the foreground, including when the driver changes permissions in Settings.
 */
export async function startPositionTracking(): Promise<void> {
  if (trackingRequested) {
    return startTrackingPromise ?? resumeForegroundTracking();
  }

  trackingRequested = true;
  updateTrackingStatus({
    appState: AppState.currentState ?? 'unknown',
    requested: true,
    foregroundPermission: 'unknown',
    backgroundPermission: 'unknown',
    gpsProvider: 'unknown',
    foregroundWatcher: 'inactive',
    backgroundService: 'inactive',
    lastSuccessfulPostAt: null,
    lastError: null,
  });
  registerAppStateListener();

  startTrackingPromise = (async () => {
    let foregroundPermission: Location.LocationPermissionResponse;

    await refreshProviderStatus();

    try {
      foregroundPermission = await Location.requestForegroundPermissionsAsync();
    } catch (error) {
      updateTrackingStatus({ foregroundPermission: 'error' });
      recordError('permission', error, 'No se pudo solicitar el permiso de ubicación en primer plano.');
      console.warn('[location-tracking] No se pudo solicitar el permiso de ubicación en primer plano.', error);
      return;
    }

    if (!trackingRequested) {
      return;
    }

    if (foregroundPermission.status !== 'granted') {
      updateTrackingStatus({ foregroundPermission: 'denied' });
      return;
    }

    updateTrackingStatus({ foregroundPermission: 'granted' });
    await startForegroundWatch();

    try {
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      const hasBackgroundPermission = backgroundPermission.status === 'granted';
      updateTrackingStatus({ backgroundPermission: hasBackgroundPermission ? 'granted' : 'denied' });

      if (hasBackgroundPermission) {
        await startBackgroundUpdates();
      }
    } catch (error) {
      updateTrackingStatus({ backgroundPermission: 'error' });
      recordError('permission', error, 'No se pudo solicitar el permiso de ubicación en segundo plano.');
      console.warn('[location-tracking] No se pudo solicitar el permiso de ubicación en segundo plano.', error);
    }
  })();

  try {
    await startTrackingPromise;
  } finally {
    startTrackingPromise = null;
  }
}

/** Stops all driver position tracking. Called on logout. */
export async function stopPositionTracking(): Promise<void> {
  trackingRequested = false;
  appStateSubscription?.remove();
  appStateSubscription = null;
  stopForegroundWatch();
  await stopBackgroundUpdates();
  updateTrackingStatus({ requested: false });
}
