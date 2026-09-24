import * as Location from 'expo-location';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';

import { StatusNotice, type StatusNoticeVariant } from '@/components/status-notice';
import { getApiBaseUrl } from '@/services/auth-session';
import {
  getLocationTrackingStatus,
  subscribeToLocationTrackingStatus,
  transportAttemptText,
} from '@/services/location-tracking';
import type { RealtimeConnectionState } from '@/services/session-websocket';
import { theme } from '@/theme';

type PermissionState = 'checking' | 'granted' | 'denied' | 'error';
type HttpsState = 'checking' | 'reachable' | 'unreachable';
type WatchState = 'registering' | 'registered' | 'failed';
type OneShotState = 'pending' | 'slow' | 'received' | 'failed';

interface RawLocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  receivedAt: number;
}

const HTTPS_CHECK_INTERVAL_MS = 5000;
const HTTPS_CHECK_TIMEOUT_MS = 5000;
const ONE_SHOT_SLOW_MS = 10000;

function permissionText(state: PermissionState): string {
  return { checking: 'Verificando…', granted: 'Concedido', denied: 'Denegado', error: 'No se pudo verificar' }[state];
}

function httpsText(state: HttpsState): string {
  return { checking: 'Verificando…', reachable: 'Conectado', unreachable: 'Sin conexión' }[state];
}

function webSocketText(connection: RealtimeConnectionState): string {
  switch (connection.status) {
    case 'connecting':
      return 'Conectando…';
    case 'connected':
      return 'Conectado';
    case 'reconnecting':
      return `Reconectando (intento ${connection.reconnectAttempt})`;
    case 'error':
      return 'Error';
    case 'disconnected':
      return 'Desconectado';
  }
}

function timeText(timestamp: number | null): string {
  return timestamp === null ? 'Sin registro horario.' : new Date(timestamp).toLocaleTimeString('es-CL');
}

function ageText(timestamp: number, now: number): string {
  return `${Math.max(0, Math.floor((now - timestamp) / 1000))} s`;
}

function availableText(value: boolean | undefined): string {
  return value === undefined ? 'Sin dato' : value ? 'Sí' : 'No';
}

/**
 * Isolated diagnostic block requested to debug GPS delivery independently
 * from the full location-tracking service (which also handles background
 * tasks, transport attempts and generation guards). This card runs its own
 * direct expo-location watcher and never sends any data to the backend: the
 * HTTPS check is a plain GET with no body, and there is no position POST
 * anywhere in this file.
 */
export function LocationTrackingStatusNotice({ connection }: { connection: RealtimeConnectionState }) {
  const [foregroundPermission, setForegroundPermission] = useState<PermissionState>('checking');
  const [backgroundPermission, setBackgroundPermission] = useState<PermissionState>('checking');
  const [provider, setProvider] = useState<Location.LocationProviderStatus | 'checking' | 'error'>('checking');
  const [watchState, setWatchState] = useState<WatchState>('registering');
  const [watchError, setWatchError] = useState<string | null>(null);
  const [callbackCount, setCallbackCount] = useState(0);
  const [watchStartedAt, setWatchStartedAt] = useState<number | null>(null);
  const [location, setLocation] = useState<RawLocationSample | null>(null);
  const [oneShotState, setOneShotState] = useState<OneShotState>('pending');
  const [oneShotError, setOneShotError] = useState<string | null>(null);
  const [oneShotResult, setOneShotResult] = useState<{ fixAt: number; accuracyMeters: number | null } | null>(null);
  const [now, setNow] = useState(0);
  const [httpsState, setHttpsState] = useState<HttpsState>('checking');
  const productionStatus = useSyncExternalStore(subscribeToLocationTrackingStatus, getLocationTrackingStatus);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1) Required permissions to read device location — read-only checks,
  // never a request, so this card never triggers a system permission dialog.
  useEffect(() => {
    let isActive = true;

    void Location.getForegroundPermissionsAsync()
      .then((result) => {
        if (!isActive) return;
        if (result.granted) {
          const startedAt = Date.now();
          setWatchStartedAt(startedAt);
          setNow(startedAt);
        }
        setForegroundPermission(result.granted ? 'granted' : 'denied');
      })
      .catch(() => isActive && setForegroundPermission('error'));

    void Location.getBackgroundPermissionsAsync()
      .then((result) => isActive && setBackgroundPermission(result.granted ? 'granted' : 'denied'))
      .catch(() => isActive && setBackgroundPermission('error'));

    return () => {
      isActive = false;
    };
  }, []);

  // Provider availability does not establish an active native request.
  useEffect(() => {
    let isActive = true;
    void Location.getProviderStatusAsync()
      .then((result) => isActive && setProvider(result))
      .catch(() => isActive && setProvider('error'));
    return () => { isActive = false; };
  }, []);

  // This foreground watcher is independent of the production tracking pipeline.
  useEffect(() => {
    if (foregroundPermission !== 'granted') return;
    let subscription: Location.LocationSubscription | null = null;
    let isActive = true;

    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: false },
      (sample) => {
        if (!isActive) return;
        setCallbackCount((count) => count + 1);
        setLocation({
          latitude: sample.coords.latitude,
          longitude: sample.coords.longitude,
          accuracyMeters: sample.coords.accuracy,
          receivedAt: Date.now(),
        });
      },
      (reason) => {
        if (isActive) setWatchError(reason);
      },
    )
      .then((result) => {
        if (!isActive) {
          result.remove();
          return;
        }
        subscription = result;
        setWatchState('registered');
      })
      .catch((error: unknown) => {
        if (isActive) {
          setWatchState('failed');
          setWatchError(error instanceof Error ? error.message : 'No se pudo iniciar el watcher de ubicación.');
        }
      });

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [foregroundPermission]);

  // One attempt only. A slow indicator is not a native timeout or cancellation.
  useEffect(() => {
    if (foregroundPermission !== 'granted') return;
    let isActive = true;
    const slowTimer = setTimeout(() => {
      if (isActive) setOneShotState('slow');
    }, ONE_SHOT_SLOW_MS);

    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false })
      .then((sample) => {
        if (!isActive) return;
        clearTimeout(slowTimer);
        setOneShotResult({ fixAt: sample.timestamp, accuracyMeters: sample.coords.accuracy });
        setOneShotState('received');
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        clearTimeout(slowTimer);
        setOneShotError(error instanceof Error ? error.message : 'No se pudo obtener una posición puntual.');
        setOneShotState('failed');
      });

    return () => {
      isActive = false;
      clearTimeout(slowTimer);
    };
  }, [foregroundPermission]);

  // 3a) Backend HTTPS reachability — a plain GET against the API base URL,
  // no body, no driver data. Polled independently of the WebSocket state.
  useEffect(() => {
    let isActive = true;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    let activeRequest: AbortController | null = null;

    const checkOnce = async () => {
      let baseUrl: URL;

      try {
        baseUrl = getApiBaseUrl();
      } catch {
        if (isActive) setHttpsState('unreachable');
        return;
      }

      const controller = new AbortController();
      activeRequest = controller;
      const abortTimer = setTimeout(() => controller.abort(), HTTPS_CHECK_TIMEOUT_MS);

      try {
        await fetch(baseUrl, { method: 'GET', signal: controller.signal });
        if (isActive) setHttpsState('reachable');
      } catch {
        if (isActive) setHttpsState('unreachable');
      } finally {
        clearTimeout(abortTimer);
        if (activeRequest === controller) activeRequest = null;
      }
    };

    const scheduleNext = () => {
      if (!isActive) return;
      timeoutHandle = setTimeout(() => {
        void checkOnce().finally(scheduleNext);
      }, HTTPS_CHECK_INTERVAL_MS);
    };

    void checkOnce().finally(scheduleNext);

    return () => {
      isActive = false;
      clearTimeout(timeoutHandle);
      activeRequest?.abort();
    };
  }, []);

  const variant: StatusNoticeVariant =
    foregroundPermission === 'denied' || provider === 'error' || watchError || watchState === 'failed' ||
    oneShotState === 'failed' || httpsState === 'unreachable' ? 'warning' : 'info';

  return (
    <StatusNotice variant={variant}>
      <Text style={styles.title}>Diagnóstico de ubicación (sin enviar datos)</Text>
      {'\n'}
      <Text style={styles.detail}>
        Permisos — Primer plano: {permissionText(foregroundPermission)}. Segundo plano: {permissionText(backgroundPermission)}.
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Proveedores — {provider === 'checking' ? 'Consultando…' : provider === 'error' ? 'Error al consultar' :
          `Servicios: ${availableText(provider.locationServicesEnabled)}. GPS: ${availableText(provider.gpsAvailable)}. Red: ${availableText(provider.networkAvailable)}. Pasivo: ${availableText(provider.passiveAvailable)}. Modo segundo plano: ${availableText(provider.backgroundModeEnabled)}.`}
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Suscripción (solo primer plano) — {foregroundPermission !== 'granted' ? 'Esperando permiso de primer plano' :
          watchState === 'registering' ? 'Registrando…' : watchState === 'failed' ? 'Registro falló' :
            'Registro JS confirmado (no confirma solicitud nativa)'}. Actualizaciones: {callbackCount}.
        {' '}{location ? `Última actualización hace ${ageText(location.receivedAt, now)}.` :
          watchStartedAt !== null ? `Sin actualizaciones tras ${ageText(watchStartedAt, now)}.` : 'Sin actualizaciones.'}
        {watchError ? ` Último error: ${watchError}` : ''}
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        {location
          ? `Flujo continuo: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (± ${location.accuracyMeters?.toFixed(0) ?? '?'} m). Última actualización: ${timeText(location.receivedAt)}.`
          : 'Flujo continuo: sin dato de la suscripción.'}
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Posición puntual (independiente del flujo continuo) — {foregroundPermission !== 'granted' ? 'Esperando permiso de primer plano.' :
          oneShotState === 'pending' ? 'Solicitando…' :
            oneShotState === 'slow' ? 'Más de 10 s; solicitud aún pendiente, sin cancelación nativa.' :
              oneShotState === 'failed' ? `Error: ${oneShotError}` :
                `Recibida: ${timeText(oneShotResult?.fixAt ?? null)} (± ${oneShotResult?.accuracyMeters?.toFixed(0) ?? '?'} m). No es una actualización de la suscripción.`}
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Backend — HTTPS: {httpsText(httpsState)}. WebSocket: {webSocketText(connection)}.
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Seguimiento de producción (solo lectura; puede enviar ubicación) — {productionStatus.requested ? 'Solicitado' : 'No solicitado'}.
        {' '}Callbacks: {productionStatus.locationCallbackCount}. Último callback: {timeText(productionStatus.lastLocationCallbackAt)}.
        {' '}Último intento de envío: {transportAttemptText(productionStatus.lastTransportAttempt)}
        {' '}Hora: {timeText(productionStatus.lastTransportAttempt.attemptedAt)}.
      </Text>
    </StatusNotice>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700' },
  detail: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
});
