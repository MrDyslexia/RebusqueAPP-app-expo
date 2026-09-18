import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { StatusNotice } from '@/components/status-notice';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';

const Camera = require('lucide-react-native/dist/cjs/icons/camera.js') as typeof import('lucide-react-native/dist/types/icons/camera').default;

export interface CapturedPhoto {
  uri: string;
  base64: string;
}

interface PhotoEvidenceFieldProps {
  onChange: (photo: CapturedPhoto | null) => void;
  photo: CapturedPhoto | null;
  /**
   * When true, this field is a mandatory step (e.g. delivery confirmation)
   * instead of optional backup evidence (e.g. failed-delivery reports).
   * Only changes copy/affordances on the client — the backend still accepts
   * `POST /encomiendas/:id/entregar` with an empty body either way.
   */
  required?: boolean;
}

export function PhotoEvidenceField({ onChange, photo, required = false }: PhotoEvidenceFieldProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  async function takePhoto() {
    if (!cameraRef.current || !isCameraReady) {
      return;
    }

    setCaptureError(null);

    try {
      const capturedPhoto = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });

      if (!capturedPhoto.base64) {
        setCaptureError('No se pudo generar la foto de evidencia. Intenta de nuevo.');
        return;
      }

      onChange({ uri: capturedPhoto.uri, base64: capturedPhoto.base64 });
      setIsCameraOpen(false);
      setIsCameraReady(false);
    } catch {
      setCaptureError('No se pudo capturar la foto. Intenta de nuevo cuando la vista previa de la cámara esté lista.');
    }
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <Image accessibilityLabel="Vista previa de la foto de evidencia local" source={{ uri: photo.uri }} style={styles.preview} />
        <Text style={styles.helper}>Foto adjunta a este formulario. Se enviará junto con la solicitud.</Text>
        <View style={styles.buttonRow}>
          <Button mode="outlined" onPress={() => onChange(null)} style={styles.secondaryButton}>
            Quitar foto
          </Button>
          <Button mode="outlined" onPress={() => setIsCameraOpen(true)} style={styles.secondaryButton}>
            Volver a tomar foto
          </Button>
        </View>
      </View>
    );
  }

  if (!isCameraOpen) {
    return (
      <Button
        accessibilityLabel={required ? 'Tomar la foto de entrega' : 'Agregar una foto de evidencia opcional'}
        icon={paperIcon(Camera)}
        mode="outlined"
        onPress={() => setIsCameraOpen(true)}
        style={styles.addPhotoButton}>
        {required ? 'Tomar foto de entrega' : 'Agregar foto opcional'}
      </Button>
    );
  }

  if (!permission || !permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <StatusNotice variant="warning">
          <Text style={styles.permissionTitle}>Se requiere permiso de cámara</Text>
          {'\n'}
          <Text style={styles.permissionText}>
            {required
              ? 'Se necesita acceso a la cámara para tomar la foto de entrega, obligatoria para confirmar.'
              : 'Se necesita acceso a la cámara solo para adjuntar una foto de respaldo opcional a este formulario.'}
          </Text>
        </StatusNotice>
        <Button mode="contained" onPress={() => void requestPermission()} style={styles.primaryButton}>
          Permitir acceso a la cámara
        </Button>
        {required ? null : (
          <Button mode="text" onPress={() => setIsCameraOpen(false)} style={styles.textButton}>
            Continuar sin foto
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={styles.cameraCard}>
      <CameraView
        ref={cameraRef}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={() => setCaptureError('No se pudo iniciar la vista previa de la cámara en este dispositivo.')}
        style={styles.camera}
      />
      {captureError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{captureError}</Text> : null}
      <View style={styles.buttonRow}>
        <Button mode="outlined" onPress={() => setIsCameraOpen(false)} style={styles.secondaryButton}>
          Cancelar
        </Button>
        <Button disabled={!isCameraReady} mode="contained" onPress={() => void takePhoto()} style={styles.primaryButton}>
          {isCameraReady ? 'Tomar foto' : 'Iniciando cámara…'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm + 2 },
  preview: { borderRadius: theme.radii.lg, height: 180, width: '100%' },
  helper: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
  // react-native-paper's `Button` has no built-in dashed-border affordance, but its
  // outer `style` prop is applied directly to the pressable container, so the
  // project's usual dashed "add evidence" style still renders correctly here.
  addPhotoButton: { borderColor: theme.colors.primary, borderRadius: theme.radii.md, borderStyle: 'dashed', borderWidth: 1.5 },
  permissionCard: { gap: theme.spacing.sm + 2 },
  permissionTitle: { fontSize: 15, fontWeight: '700' },
  permissionText: { fontSize: 13, lineHeight: 18 },
  cameraCard: { gap: theme.spacing.sm + 2 },
  camera: { borderRadius: theme.radii.lg, height: 260, overflow: 'hidden', width: '100%' },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm + 2 },
  primaryButton: { borderRadius: theme.radii.pill, flex: 1 },
  secondaryButton: { borderColor: theme.colors.primary, borderRadius: theme.radii.pill, flex: 1 },
  textButton: { alignSelf: 'flex-start' },
  error: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
});
