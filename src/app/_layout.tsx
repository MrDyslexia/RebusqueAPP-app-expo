import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';

import { paperTheme } from '@/theme/paper-theme';

// Side-effect import: registers the DEP-002 background location task
// (`TaskManager.defineTask`) at module scope before the app can ever call
// `Location.startLocationUpdatesAsync`. Must stay a top-level import here,
// not inside a component or effect.
import '@/services/location-tracking';
import { restorePersistedConductorSession } from '@/services/session-bootstrap';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    void restorePersistedConductorSession().then((restored) => {
      if (isMounted && restored) {
        router.replace('/conductor');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="conductor/index" options={{ headerShown: false }} />
        <Stack.Screen name="conductor/shipments/index" options={{ title: 'Mis encomiendas' }} />
        <Stack.Screen name="conductor/[shipmentId]" options={{ title: 'Detalle de la encomienda' }} />
        <Stack.Screen name="conductor/[shipmentId]/delivery" options={{ title: 'Confirmar entrega' }} />
        <Stack.Screen name="conductor/scan/index" options={{ title: 'Escanear código QR' }} />
        <Stack.Screen name="conductor/scan/[shipmentId]" options={{ title: 'Escanear código QR' }} />
        <Stack.Screen name="conductor/report-failure" options={{ title: 'Reportar falla de entrega' }} />
        <Stack.Screen name="conductor/incident-history" options={{ title: 'Historial de incidentes' }} />
      </Stack>
    </PaperProvider>
  );
}
