import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appConfig } from '@/config/app-config';
import { signIn } from '@/services/auth-session';
import { saveSessionToken } from '@/services/session-token-store';
import { theme } from '@/theme';
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
          <View style={styles.fixtureForm}>
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
              onChangeText={setRut}
              placeholder="RUT de prueba"
              style={styles.input}
              value={rut}
            />
            <TextInput
              accessibilityLabel="Contraseña de prueba"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Contraseña de prueba"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
            <Pressable
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={() => void signInToWorkspace()}>
              <Text style={styles.primaryButtonText}>Abrir espacio de trabajo de prueba</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loginForm}>
            <TextInput
              accessibilityLabel="RUT"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="default"
              maxLength={12}
              onChangeText={handleRutChange}
              placeholder="12.345.678-5"
              style={styles.input}
              value={rut}
            />
            <View style={styles.passwordField}>
              <TextInput
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                maxLength={12}
                onChangeText={setPassword}
                placeholder="Contraseña"
                secureTextEntry={!isPasswordVisible}
                style={[styles.input, styles.passwordInput]}
                value={password}
              />
              <Pressable
                accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting, selected: isPasswordVisible }}
                disabled={isSubmitting}
                onPress={() => setIsPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}>
                {isPasswordVisible ? (
                  <EyeOff color={theme.colors.primary} size={24} />
                ) : (
                  <Eye color={theme.colors.primary} size={24} />
                )}
              </Pressable>
            </View>
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
            <Pressable
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={() => void signInToWorkspace()}>
              <Text style={styles.primaryButtonText}>{isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}</Text>
            </Pressable>
          </View>
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
    gap: theme.spacing.sm,
    marginTop: theme.spacing.base,
    padding: theme.spacing.base,
  },
  loginForm: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.base,
    padding: theme.spacing.base,
    ...theme.shadows.card,
  },
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
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.text.primary,
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  passwordField: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 80,
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  passwordTogglePressed: {
    opacity: 0.65,
  },
  errorText: {
    color: theme.colors.status.danger.text,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 14,
  },
  primaryButtonText: {
    ...theme.typography.buttonLabel,
    color: theme.colors.text.onPrimary,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  footer: {
    color: theme.colors.text.muted,
    fontSize: 13,
    marginTop: theme.spacing.md,
  },
});
