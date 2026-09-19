import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { ConductorApiError } from '@/services/conductor-api';
import { getConductorApi } from '@/services/get-conductor-api';
import { invalidateSessionAndRedirectToLogin } from '@/services/session-token-store';

/**
 * DEP-002 — real-time driver position tracking. Starts on successful login
 * and stops on logout, independent of shipment state: 1 position/second in
 * foreground, 1 position/5 seconds (0.2Hz) in background, switching
 * automatically with `AppState`. This is telemetry, not an access gate: any
 * denied location permission degrades gracefully instead of blocking login
 * or throwing.
 *
 * The background task must be defined at module scope, before any
 * `startLocationUpdatesAsync` call can reference it. This module is
 * imported early from the root layout for that reason — see
 * `src/app/_layout.tsx`.
 */
const LOCATION_TASK_NAME = 'rebusqueapp-conductor-position-tracking';

let foregroundWatchSubscription: Location.LocationSubscription | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let isTrackingActive = false;

async function sendPosition(coords: { latitude: number; longitude: number }): Promise<void> {
  try {
    await getConductorApi().reportPosition({ latitud: coords.latitude, longitud: coords.longitude });
  } catch (error) {
    if (error instanceof ConductorApiError) {
      if (error.status === 401) {
        // Sesión inválida o reemplazada: mismo flujo centralizado que el
        // resto de la app (ver `qr-resolution.ts`). Detener el tracking
        // primero para no seguir intentando enviar posiciones sin sesión.
        await stopPositionTracking();
        await invalidateSessionAndRedirectToLogin();
        return;
      }

      if (error.status === 429) {
        // `posicion_demasiado_frecuente`: autolimitación esperada del
        // backend (< 900ms desde el último envío aceptado), no un error real.
        return;
      }

      console.warn('[location-tracking] No se pudo enviar la posición del conductor.', error.message);
      return;
    }

    console.warn('[location-tracking] Error inesperado al enviar la posición del conductor.', error);
  }
}

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.warn('[location-tracking] Falla en la tarea de ubicación en segundo plano.', error.message);
      return;
    }

    for (const location of data?.locations ?? []) {
      await sendPosition(location.coords);
    }
  },
);

async function startForegroundWatch(): Promise<void> {
  if (foregroundWatchSubscription) {
    return;
  }

  foregroundWatchSubscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 1000, distanceInterval: 0 },
    (location) => void sendPosition(location.coords),
  );
}

function stopForegroundWatch(): void {
  foregroundWatchSubscription?.remove();
  foregroundWatchSubscription = null;
}

async function startBackgroundUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
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
}

async function stopBackgroundUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'background') {
    stopForegroundWatch();
    void startBackgroundUpdates();
  } else if (nextState === 'active') {
    void stopBackgroundUpdates();
    void startForegroundWatch();
  }
}

/**
 * Starts driver position tracking right after a successful login. Requests
 * the foreground permission first; if denied, does nothing else (no
 * throw — location telemetry never blocks the driver's session). If
 * granted, starts the 1Hz foreground watcher immediately, then requests the
 * background permission. Background denied degrades gracefully to
 * foreground-only tracking (no `AppState` listener registered).
 */
export async function startPositionTracking(): Promise<void> {
  if (isTrackingActive) {
    return;
  }

  isTrackingActive = true;

  let foregroundPermission: Location.LocationPermissionResponse;

  try {
    foregroundPermission = await Location.requestForegroundPermissionsAsync();
  } catch (error) {
    console.warn('[location-tracking] No se pudo solicitar el permiso de ubicación en primer plano.', error);
    isTrackingActive = false;
    return;
  }

  if (foregroundPermission.status !== 'granted') {
    console.warn('[location-tracking] Permiso de ubicación en primer plano denegado; no se enviará la posición del conductor.');
    isTrackingActive = false;
    return;
  }

  await startForegroundWatch();

  let backgroundPermission: Location.LocationPermissionResponse;

  try {
    backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  } catch (error) {
    console.warn('[location-tracking] No se pudo solicitar el permiso de ubicación en segundo plano.', error);
    return;
  }

  if (backgroundPermission.status !== 'granted') {
    console.warn('[location-tracking] Permiso de ubicación en segundo plano denegado; se continúa solo en primer plano.');
    return;
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

/** Stops all driver position tracking. Called on logout. */
export async function stopPositionTracking(): Promise<void> {
  isTrackingActive = false;
  appStateSubscription?.remove();
  appStateSubscription = null;
  stopForegroundWatch();
  await stopBackgroundUpdates();
}
