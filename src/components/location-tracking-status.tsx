import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { StatusNotice, type StatusNoticeVariant } from '@/components/status-notice';
import {
  getLocationTrackingStatus,
  subscribeToLocationTrackingStatus,
  type LocationTrackingStatus,
} from '@/services/location-tracking';
import { theme } from '@/theme';

function getOperationalStateText(status: LocationTrackingStatus): string {
  switch (status.operationalState) {
    case 'tracking':
      return 'Enviando ubicación al servidor.';
    case 'background-tracking':
      return 'La aplicación está en segundo plano y el servicio sigue activo.';
    case 'app-open-without-gps':
      return 'App abierta, sin GPS. Revisa el permiso, la señal y el último envío.';
    case 'not-tracking':
      return 'El seguimiento no está activo.';
  }
}

function getStatusVariant(status: LocationTrackingStatus): StatusNoticeVariant {
  if (status.lastError || status.foregroundWatcher === 'error' || status.backgroundService === 'error') {
    return 'warning';
  }

  if (status.operationalState === 'tracking') {
    return 'success';
  }

  return status.operationalState === 'app-open-without-gps' ? 'warning' : 'info';
}

function permissionText(status: LocationTrackingStatus['foregroundPermission']): string {
  return {
    unknown: 'Sin verificar',
    granted: 'Concedido',
    denied: 'Denegado',
    error: 'No disponible por error',
  }[status];
}

function workerText(status: LocationTrackingStatus['foregroundWatcher']): string {
  return {
    inactive: 'Inactivo',
    starting: 'Iniciando',
    active: 'Activo',
    unavailable: 'No disponible',
    error: 'Con error',
  }[status];
}

function providerText(status: LocationTrackingStatus['gpsProvider']): string {
  return {
    unknown: 'Sin verificar',
    available: 'Disponible',
    unavailable: 'No disponible',
    error: 'No disponible por error',
  }[status];
}

function timestampText(timestamp: number | null): string {
  return timestamp === null
    ? 'Aún no hay un POST confirmado.'
    : `Confirmado a las ${new Date(timestamp).toLocaleTimeString('es-CL')}.`;
}

export function LocationTrackingStatusNotice() {
  const [status, setStatus] = useState(getLocationTrackingStatus);

  useEffect(() => subscribeToLocationTrackingStatus(() => setStatus(getLocationTrackingStatus())), []);

  return (
    <StatusNotice variant={getStatusVariant(status)}>
      <Text style={styles.title}>Ubicación del conductor</Text>
      {'\n'}
      <Text style={styles.message}>{getOperationalStateText(status)}</Text>
      {'\n'}
      <Text style={styles.detail}>Permiso en primer plano: {permissionText(status.foregroundPermission)}.</Text>
      {'\n'}
      <Text style={styles.detail}>Permiso en segundo plano: {permissionText(status.backgroundPermission)}.</Text>
      {'\n'}
      <Text style={styles.detail}>Proveedor GPS: {providerText(status.gpsProvider)}.</Text>
      {'\n'}
      <Text style={styles.detail}>Watcher en primer plano: {workerText(status.foregroundWatcher)}.</Text>
      {'\n'}
      <Text style={styles.detail}>Servicio en segundo plano: {workerText(status.backgroundService)}.</Text>
      {'\n'}
      <Text style={styles.detail}>Último POST exitoso: {timestampText(status.lastSuccessfulPostAt)}</Text>
      {'\n'}
      <Text style={styles.detail}>
        Último error: {status.lastError ? `${status.lastError.message} (${new Date(status.lastError.occurredAt).toLocaleTimeString('es-CL')}).` : 'Sin errores registrados.'}
      </Text>
    </StatusNotice>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20 },
  detail: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
});
