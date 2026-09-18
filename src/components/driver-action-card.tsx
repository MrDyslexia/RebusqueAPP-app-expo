import type { ComponentType } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { List } from 'react-native-paper';

import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';

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
    <List.Item
      accessibilityLabel={accessibilityLabel}
      description={description}
      descriptionStyle={styles.description}
      left={() => (
        <View style={styles.iconContainer}>
          <Icon color={theme.colors.primary} size={23} strokeWidth={2.25} />
        </View>
      )}
      onPress={onPress}
      right={() => <List.Icon color={theme.colors.primary} icon={paperIcon(ChevronRight)} />}
      style={styles.card}
      title={title}
      titleStyle={styles.title}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    minHeight: 92,
    paddingHorizontal: theme.spacing.base,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
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
});
