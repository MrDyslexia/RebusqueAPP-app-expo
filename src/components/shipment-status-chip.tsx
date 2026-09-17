import { StyleSheet, Text, View } from 'react-native';

import type { ShipmentStatus } from '@/domain/shipment';
import { theme } from '@/theme';

const statusLabels: Record<ShipmentStatus, string> = {
  procesando: 'Procesando',
  asignada: 'Asignada',
  en_ruta: 'En ruta',
  retirado: 'Retirado',
  en_sucursal: 'En sucursal',
  en_reparto: 'En reparto',
  entregada: 'Entregada',
  fallida: 'Entrega fallida',
  finalizada: 'Finalizada',
};

const statusStyles: Record<ShipmentStatus, { backgroundColor: string; color: string }> = {
  procesando: { backgroundColor: theme.colors.status.neutral.background, color: theme.colors.status.neutral.text },
  asignada: { backgroundColor: theme.colors.status.info.background, color: theme.colors.status.info.text },
  en_ruta: { backgroundColor: theme.colors.status.success.background, color: theme.colors.status.success.text },
  retirado: { backgroundColor: theme.colors.status.info.background, color: theme.colors.status.info.text },
  en_sucursal: { backgroundColor: theme.colors.status.warning.background, color: theme.colors.status.warning.text },
  en_reparto: { backgroundColor: theme.colors.status.violet.background, color: theme.colors.status.violet.text },
  entregada: { backgroundColor: theme.colors.status.success.background, color: theme.colors.status.success.text },
  fallida: { backgroundColor: theme.colors.status.danger.background, color: theme.colors.status.danger.text },
  finalizada: { backgroundColor: theme.colors.status.neutral.background, color: theme.colors.status.neutral.text },
};

export function ShipmentStatusChip({ status }: { status?: ShipmentStatus }) {
  if (!status) {
    return (
      <View style={[styles.chip, styles.unknownChip]}>
        <Text style={[styles.label, styles.unknownLabel]}>Estado pendiente de sincronización</Text>
      </View>
    );
  }

  const palette = statusStyles[status];

  return (
    <View style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.color }]}>{statusLabels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  unknownChip: {
    backgroundColor: theme.colors.status.neutral.background,
  },
  unknownLabel: {
    color: theme.colors.status.neutral.text,
  },
});
