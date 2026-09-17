import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
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
    </>
  );
}
