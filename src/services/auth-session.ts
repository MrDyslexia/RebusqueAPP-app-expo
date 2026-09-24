import { appConfig } from '@/config/app-config';
import { getDeviceIdentifier } from '@/services/device-identity';

export interface LoginCredentials {
  rut: string;
  password: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function getApiBaseUrl(): URL {
  const configuredUrl = appConfig.apiBaseUrl.trim();

  if (!configuredUrl) {
    throw new AuthenticationError('La URL del backend no está configurada. Configura EXPO_PUBLIC_API_BASE_URL.');
  }

  let apiBaseUrl: URL;

  try {
    apiBaseUrl = new URL(configuredUrl);
  } catch {
    throw new AuthenticationError('La URL del backend no es válida. Configura EXPO_PUBLIC_API_BASE_URL con una URL HTTP(S).');
  }

  if (apiBaseUrl.protocol !== 'http:' && apiBaseUrl.protocol !== 'https:') {
    throw new AuthenticationError('La URL del backend debe usar http o https.');
  }

  return apiBaseUrl;
}

function isTokenResponse(value: unknown): value is { token: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'token' in value &&
    typeof value.token === 'string' &&
    value.token.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getSafeBackendMessage(value: unknown, sensitiveValues: readonly string[]): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const message = value.trim();

  if (!message || message.length > 200) {
    return null;
  }

  const normalizedMessage = message.toLowerCase();
  const normalizedSensitiveValues = sensitiveValues
    .map((sentValue) => sentValue.trim().toLowerCase())
    .filter(Boolean);

  return normalizedSensitiveValues.some((sentValue) => normalizedMessage.includes(sentValue))
    ? null
    : message;
}

function getValidationMessage(value: unknown, sensitiveValues: readonly string[]): string | null {
  if (!isRecord(value) || value.error !== 'validation_error' || !isRecord(value.issues)) {
    return null;
  }

  for (const field of ['rut', 'password'] as const) {
    const fieldIssues = value.issues[field];

    if (!Array.isArray(fieldIssues)) {
      continue;
    }

    for (const issue of fieldIssues) {
      const message = getSafeBackendMessage(issue, sensitiveValues);

      if (message) {
        return message;
      }
    }
  }

  return null;
}

export async function signIn(credentials: LoginCredentials): Promise<string> {
  const apiBaseUrl = getApiBaseUrl();
  const loginUrl = new URL('/auth/login', apiBaseUrl);
  const deviceIdentifier = await getDeviceIdentifier();
  const sensitiveValues = [credentials.rut, credentials.password, deviceIdentifier];

  let response: Response;

  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rut: credentials.rut,
        password: credentials.password,
        deviceIdentifier,
      }),
    });
  } catch {
    throw new AuthenticationError('No fue posible conectar con el servicio de autenticación.');
  }

  if (!response.ok) {
    let errorBody: unknown;

    try {
      errorBody = await response.json();
    } catch {
      // Keep the generic error for non-JSON error responses.
    }

    const validationMessage = getValidationMessage(errorBody, sensitiveValues);
    const backendMessage = isRecord(errorBody)
      ? getSafeBackendMessage(errorBody.message, sensitiveValues)
      : null;
    const errorMessage = validationMessage ?? backendMessage;

    if (errorMessage) {
      throw new AuthenticationError(errorMessage);
    }

    throw new AuthenticationError(`No se pudo iniciar sesión (HTTP ${response.status}). Verifica tu RUT y contraseña.`);
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new AuthenticationError(
      'Error de contrato de autenticación: se esperaba una respuesta JSON con un campo "token" de tipo string.',
    );
  }

  if (!isTokenResponse(responseBody)) {
    throw new AuthenticationError(
      'Error de contrato de autenticación: se esperaba un campo "token" no vacío de tipo string en la respuesta de inicio de sesión.',
    );
  }

  return responseBody.token;
}

export function getWebSocketUrl(token: string): string {
  const apiBaseUrl = getApiBaseUrl();
  const webSocketUrl = new URL('/ws', apiBaseUrl);

  webSocketUrl.protocol = apiBaseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  webSocketUrl.searchParams.set('token', token);

  return webSocketUrl.toString();
}
