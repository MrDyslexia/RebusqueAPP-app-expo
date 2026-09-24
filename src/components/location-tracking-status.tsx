import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { StatusNotice, type StatusNoticeVariant } from '@/components/status-notice';
import { getApiBaseUrl } from '@/services/auth-session';
import type { RealtimeConnectionState } from '@/services/session-websocket';
import { theme } from '@/theme';

type PermissionState = 'checking' | 'granted' | 'denied' | 'error';
type HttpsState = 'checking' | 'reachable' | 'unreachable';

interface RawLocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  receivedAt: number;
}

const HTTPS_CHECK_INTERVAL_MS = 5000;
const HTTPS_CHECK_TIMEOUT_MS = 5000;

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
  const [location, setLocation] = useState<RawLocationSample | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [httpsState, setHttpsState] = useState<HttpsState>('checking');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1) Required permissions to read device location — read-only checks,
  // never a request, so this card never triggers a system permission dialog.
  useEffect(() => {
    let isActive = true;

    void Location.getForegroundPermissionsAsync()
      .then((result) => isActive && setForegroundPermission(result.granted ? 'granted' : 'denied'))
      .catch(() => isActive && setForegroundPermission('error'));

    void Location.getBackgroundPermissionsAsync()
      .then((result) => isActive && setBackgroundPermission(result.granted ? 'granted' : 'denied'))
      .catch(() => isActive && setBackgroundPermission('error'));

    return () => {
      isActive = false;
    };
  }, []);

  // 2) Device-reported location, refreshed at least every second. Direct
  // watchPositionAsync, independent of the production tracking pipeline —
  // no POST, no WebSocket send, purely a read display for this diagnostic.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isActive = true;

    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 1000, distanceInterval: 0 },
      (sample) => {
        if (!isActive) return;
        setLocation({
          latitude: sample.coords.latitude,
          longitude: sample.coords.longitude,
          accuracyMeters: sample.coords.accuracy,
          receivedAt: Date.now(),
        });
      },
    )
      .then((result) => {
        if (!isActive) {
          result.remove();
          return;
        }
        subscription = result;
      })
      .catch((error: unknown) => {
        if (isActive) setLocationError(error instanceof Error ? error.message : 'No se pudo iniciar el watcher de ubicación.');
      });

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, []);

  // 3a) Backend HTTPS reachability — a plain GET against the API base URL,
  // no body, no driver data. Polled independently of the WebSocket state.
  useEffect(() => {
    let isActive = true;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const checkOnce = async () => {
      let baseUrl: URL;

      try {
        baseUrl = getApiBaseUrl();
      } catch {
        if (isActive) setHttpsState('unreachable');
        return;
      }

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), HTTPS_CHECK_TIMEOUT_MS);

      try {
        await fetch(baseUrl, { method: 'GET', signal: controller.signal });
        if (isActive) setHttpsState('reachable');
      } catch {
        if (isActive) setHttpsState('unreachable');
      } finally {
        clearTimeout(abortTimer);
      }
    };

    const scheduleNext = () => {
      timeoutHandle = setTimeout(() => {
        void checkOnce().finally(scheduleNext);
      }, HTTPS_CHECK_INTERVAL_MS);
    };

    void checkOnce().finally(scheduleNext);

    return () => {
      isActive = false;
      clearTimeout(timeoutHandle);
    };
  }, []);

  const variant: StatusNoticeVariant =
    foregroundPermission === 'denied' || locationError || httpsState === 'unreachable' ? 'warning' : 'info';

  return (
    <StatusNotice variant={variant}>
      <Text style={styles.title}>Diagnóstico de ubicación (sin enviar datos)</Text>
      {'\n'}
      <Text style={styles.detail}>
        Permisos — Primer plano: {permissionText(foregroundPermission)}. Segundo plano: {permissionText(backgroundPermission)}.
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        {location
          ? `Ubicación: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (± ${location.accuracyMeters?.toFixed(0) ?? '?'} m). Última actualización: ${timeText(location.receivedAt)}.`
          : locationError
            ? `Ubicación: error — ${locationError}`
            : 'Ubicación: esperando el primer dato del GPS…'}
      </Text>
      {'\n'}
      <Text style={styles.detail}>
        Backend — HTTPS: {httpsText(httpsState)}. WebSocket: {webSocketText(connection)}.
      </Text>
    </StatusNotice>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700' },
  detail: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
});
