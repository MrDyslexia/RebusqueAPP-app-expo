import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const SESSION_TOKEN_KEY = 'rebusqueapp.session-token';

export class SessionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionStorageError';
  }
}

async function ensureSecureStoreAvailability(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new SessionStorageError('El almacenamiento seguro de sesión no está disponible en este dispositivo.');
  }
}

export async function saveSessionToken(token: string): Promise<void> {
  await ensureSecureStoreAvailability();

  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    throw new SessionStorageError('No fue posible guardar la sesión de forma segura en este dispositivo.');
  }
}

export async function getSessionToken(): Promise<string | null> {
  await ensureSecureStoreAvailability();

  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    throw new SessionStorageError('No fue posible leer la sesión segura en este dispositivo.');
  }
}

/**
 * Removes the stored session token. Used when the backend reports the
 * session as invalid or replaced (`HTTP 401`), per the "borrar sesión y
 * pedir login, nunca reintentar" rule in `Flujo QR Conductores.md`.
 */
export async function clearSessionToken(): Promise<void> {
  await ensureSecureStoreAvailability();

  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    throw new SessionStorageError('No fue posible eliminar la sesión almacenada en este dispositivo.');
  }
}

/**
 * Centralizes the "borrar sesión y pedir login, nunca reintentar" reaction
 * to an `HTTP 401` from any conductor endpoint (QR resolution/transitions,
 * position reporting, etc). Never throws: clearing the token is
 * best-effort, and the driver is redirected to login regardless of whether
 * it succeeded, matching the sign-out flow in `conductor/index.tsx`.
 */
export async function invalidateSessionAndRedirectToLogin(): Promise<void> {
  await clearSessionToken().catch(() => {
    // Best-effort: still force the driver back to login below even if
    // clearing the stored token itself failed.
  });
  router.replace('/');
}
