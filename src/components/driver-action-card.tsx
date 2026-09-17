import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

interface DriverActionCardProps {
  accessibilityLabel: string;
  description: string;
  icon: IconComponent;
  onPress: () => void;
  title: string;
}

export function DriverActionCard({
  accessibilityLabel,
  description,
  icon: Icon,
  onPress,
  title,
}: DriverActionCardProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.iconContainer}>
        <Icon color={theme.colors.primary} size={23} strokeWidth={2.25} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text accessibilityElementsHidden style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: 92,
    padding: theme.spacing.base,
    ...theme.shadows.card,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfacePressed,
    borderColor: theme.colors.primary,
    ...theme.shadows.cardPressed,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  arrow: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: '400',
  },
});
