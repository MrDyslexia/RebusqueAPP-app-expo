import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

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
          <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Quitar foto</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setIsCameraOpen(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Volver a tomar foto</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!isCameraOpen) {
    return (
      <Pressable
        accessibilityLabel={required ? 'Tomar la foto de entrega' : 'Agregar una foto de evidencia opcional'}
        accessibilityRole="button"
        onPress={() => setIsCameraOpen(true)}
        style={({ pressed }) => [styles.addPhotoButton, pressed && styles.pressed]}>
        <Camera color={theme.colors.primary} size={20} />
        <Text style={styles.addPhotoText}>{required ? 'Tomar foto de entrega' : 'Agregar foto opcional'}</Text>
      </Pressable>
    );
  }

  if (!permission || !permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>Se requiere permiso de cámara</Text>
        <Text style={styles.helper}>
          {required
            ? 'Se necesita acceso a la cámara para tomar la foto de entrega, obligatoria para confirmar.'
            : 'Se necesita acceso a la cámara solo para adjuntar una foto de respaldo opcional a este formulario.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Permitir acceso a la cámara</Text>
        </Pressable>
        {required ? null : (
          <Pressable accessibilityRole="button" onPress={() => setIsCameraOpen(false)} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Continuar sin foto</Text>
          </Pressable>
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
        <Pressable accessibilityRole="button" onPress={() => setIsCameraOpen(false)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
        <Pressable
          accessibilityState={{ disabled: !isCameraReady }}
          accessibilityRole="button"
          disabled={!isCameraReady}
          onPress={() => void takePhoto()}
          style={[styles.primaryButton, !isCameraReady && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{isCameraReady ? 'Tomar foto' : 'Iniciando cámara…'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm + 2 },
  preview: { borderRadius: theme.radii.lg, height: 180, width: '100%' },
  helper: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },
  addPhotoButton: {
    alignItems: 'center', borderColor: theme.colors.primary, borderRadius: theme.radii.md, borderStyle: 'dashed', borderWidth: 1.5,
    flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.md + 2,
  },
  addPhotoText: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  pressed: { backgroundColor: theme.colors.primarySoft },
  permissionCard: { backgroundColor: theme.colors.status.warning.background, borderColor: theme.colors.status.warning.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: theme.spacing.sm + 2, padding: theme.spacing.md + 2 },
  permissionTitle: { color: theme.colors.status.warning.text, fontSize: 15, fontWeight: '700' },
  cameraCard: { gap: theme.spacing.sm + 2 },
  camera: { borderRadius: theme.radii.lg, height: 260, overflow: 'hidden', width: '100%' },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm + 2 },
  primaryButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: theme.spacing.md },
  primaryButtonText: { color: theme.colors.text.onPrimary, fontSize: 14, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: theme.colors.primary, borderRadius: theme.radii.pill, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: theme.spacing.md },
  secondaryButtonText: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  textButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  textButtonLabel: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  error: { color: theme.colors.status.danger.text, fontSize: 13, lineHeight: 18 },
});
