import { Modal, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

const X = require('lucide-react-native/dist/cjs/icons/x.js') as typeof import('lucide-react-native/dist/types/icons/x').default;

interface FullScreenImageViewerProps {
  onClose: () => void;
  uri: string | null;
}

/**
 * Full-screen modal viewer for a single remote/local image URI (e.g. the
 * delivery photo shown in the shipment detail screen). Tapping the backdrop
 * or the close (X) button dismisses it; no zoom/pan beyond native
 * `contain` fit is implemented, matching the app's current photo-review
 * needs (confirm what was captured, not inspect pixel detail).
 */
export function FullScreenImageViewer({ onClose, uri }: FullScreenImageViewerProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={uri !== null}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'right']}>
        <Pressable accessibilityLabel="Cerrar vista de la foto" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <X color={theme.colors.text.onSecondary} size={26} />
        </Pressable>
        <Pressable onPress={onClose} style={styles.backdrop}>
          {uri ? <Image contentFit="contain" source={{ uri }} style={styles.image} /> : null}
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.overlay.scannerBackdrop, flex: 1 },
  backdrop: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  image: { height: '100%', width: '100%' },
  closeButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    height: 44,
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    marginTop: theme.spacing.sm,
    width: 44,
    zIndex: 1,
  },
});
