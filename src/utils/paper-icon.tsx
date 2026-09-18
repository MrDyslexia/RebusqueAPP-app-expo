import type { ComponentType } from 'react';

interface LucideIconProps {
  color?: string;
  size?: number;
}

/**
 * Adapts a lucide-react-native icon component (imported via this project's
 * deep-import-per-icon pattern, e.g.
 * `require('lucide-react-native/dist/cjs/icons/x.js')`) into the render-prop
 * shape react-native-paper expects for its `icon` prop on `Button`,
 * `IconButton`, `Chip`, `TextInput.Icon`, etc.: a function receiving
 * `{ size, color }` and returning a `ReactNode`.
 *
 * Without this adapter, lucide icon components (which take `color`/`size`
 * directly as props) cannot be passed to Paper's `icon=` prop, which calls
 * its value as `icon({ size, color })` instead of rendering it as JSX.
 */
export function paperIcon(LucideIconComponent: ComponentType<LucideIconProps>) {
  return function PaperIconAdapter({ color, size }: { color: string; size: number }) {
    return <LucideIconComponent color={color} size={size} />;
  };
}
