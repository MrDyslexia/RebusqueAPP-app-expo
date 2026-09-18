import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, HelperText, TextInput } from 'react-native-paper';

import { appConfig } from '@/config/app-config';
import { signIn } from '@/services/auth-session';
import { saveSessionToken } from '@/services/session-token-store';
import { theme } from '@/theme';
import { paperIcon } from '@/utils/paper-icon';
import { formatChileanRutInput, validateChileanRut } from '@/utils/chilean-rut';

const Eye = require('lucide-react-native/dist/cjs/icons/eye.js') as typeof import('lucide-react-native/dist/types/icons/eye').default;
const EyeOff = require('lucide-react-native/dist/cjs/icons/eye-off.js') as typeof import('lucide-react-native/dist/types/icons/eye-off').default;

const fixtureCredentials = {
  rut: 'fixture-rut',
  password: 'fixture-access-only',
} as const;

export default function LoginScreen() {
  const router = useRouter();
  const [rut, setRut] = useState<string>(appConfig.fixturesEnabled ? fixtureCredentials.rut : '');
  const [password, setPassword] = useState<string>(
    appConfig.fixturesEnabled ? fixtureCredentials.password : '',
  );
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleRutChange(value: string) {
    const formattedRut = formatChileanRutInput(value);

    if (formattedRut !== null) {
      setRut(formattedRut);
    }
  }

  async function signInToWorkspace() {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      if (appConfig.fixturesEnabled) {
        if (rut !== fixtureCredentials.rut || password !== fixtureCredentials.password) {
          throw new Error('Usa las credenciales de prueba mostradas arriba.');
        }
      } else {
        const validatedRut = validateChileanRut(rut);

        if (!validatedRut.valid) {
          throw new Error('Ingresa un RUT válido con su dígito verificador, por ejemplo 12.345.678-5.');
        }

        if (!password) {
          throw new Error('Ingresa tu contraseña de conductor.');
        }

        const token = await signIn({ rut: validatedRut.canonical, password });
        await saveSessionToken(token);
      }

      router.replace('/conductor');
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : 'No fue posible iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>REBUSQUEAPP</Text>
        <Text style={styles.title}>Espacio de trabajo del conductor</Text>
        <Text style={styles.description}>
          Inicia sesión con tu RUT y contraseña de conductor.
        </Text>

        {appConfig.fixturesEnabled ? (
          <Card style={styles.fixtureForm}>
            <Card.Content style={styles.cardContent}>
              <Text style={styles.fixtureTitle}>Inicio de sesión de prueba (desarrollo)</Text>
              <Text style={styles.fixtureText}>
                Esta no es una cuenta de producción. Usa las credenciales ficticias a continuación para abrir encomiendas de prueba locales.
              </Text>
              <Text style={styles.credentialHint}>RUT: {fixtureCredentials.rut}</Text>
              <Text style={styles.credentialHint}>Contraseña: {fixtureCredentials.password}</Text>
              <TextInput
                accessibilityLabel="RUT de prueba"
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                onChangeText={setRut}
                placeholder="RUT de prueba"
                value={rut}
              />
              <TextInput
                accessibilityLabel="Contraseña de prueba"
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                onChangeText={setPassword}
                placeholder="Contraseña de prueba"
                secureTextEntry
                value={password}
              />
              <HelperText type="error" visible={Boolean(loginError)}>
                {loginError}
              </HelperText>
              <Button
                disabled={isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => void signInToWorkspace()}
                style={styles.primaryButton}>
                Abrir espacio de trabajo de prueba
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.loginForm}>
            <Card.Content style={styles.cardContent}>
              <TextInput
                accessibilityLabel="RUT"
                autoCapitalize="characters"
                autoCorrect={false}
                disabled={isSubmitting}
                keyboardType="default"
                maxLength={12}
                mode="outlined"
                onChangeText={handleRutChange}
                placeholder="12.345.678-5"
                value={rut}
              />
              <TextInput
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoCorrect={false}
                disabled={isSubmitting}
                maxLength={12}
                mode="outlined"
                onChangeText={setPassword}
                placeholder="Contraseña"
                right={(
                  <TextInput.Icon
                    accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    icon={paperIcon(isPasswordVisible ? EyeOff : Eye)}
                    onPress={() => setIsPasswordVisible((visible) => !visible)}
                  />
                )}
                secureTextEntry={!isPasswordVisible}
                value={password}
              />
              <HelperText type="error" visible={Boolean(loginError)}>
                {loginError}
              </HelperText>
              <Button
                disabled={isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => void signInToWorkspace()}
                style={styles.primaryButton}>
                {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.footer}>
          Modo de prueba: {appConfig.fixturesEnabled ? 'activado' : 'desactivado'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.base,
  },
  eyebrow: {
    ...theme.typography.brandEyebrow,
  },
  title: {
    ...theme.typography.displayTitle,
  },
  description: {
    ...theme.typography.subtitle,
    fontSize: 16,
    lineHeight: 24,
  },
  fixtureForm: {
    backgroundColor: theme.colors.status.info.background,
    borderColor: theme.colors.status.info.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    marginTop: theme.spacing.base,
  },
  loginForm: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    marginTop: theme.spacing.base,
    ...theme.shadows.card,
  },
  cardContent: { gap: theme.spacing.sm },
  fixtureTitle: {
    color: theme.colors.status.info.text,
    fontSize: 16,
    fontWeight: '700',
  },
  fixtureText: {
    color: theme.colors.status.info.text,
    fontSize: 14,
    lineHeight: 20,
  },
  credentialHint: {
    color: theme.colors.status.info.text,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: theme.radii.pill,
    marginTop: theme.spacing.xs,
  },
  footer: {
    color: theme.colors.text.muted,
    fontSize: 13,
    marginTop: theme.spacing.md,
  },
});
