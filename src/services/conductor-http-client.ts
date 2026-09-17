import { appConfig } from '@/config/app-config';
import { ConductorApiError, SessionUnavailableError } from '@/services/conductor-api';
import { getSessionToken } from '@/services/session-token-store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Mirrors the safe-message extraction already proven in `auth-session.ts`:
 * the backend `message` field is always safe to display as-is, so the only
 * job here is to reject non-string/oversized values before trusting them.
 */
function getSafeBackendMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const message = value.trim();

  return message && message.length <= 200 ? message : null;
}

function getValidationMessage(value: unknown): string | null {
  if (!isRecord(value) || value.error !== 'validation_error' || !isRecord(value.issues)) {
    return null;
  }

  for (const fieldIssues of Object.values(value.issues)) {
    if (!Array.isArray(fieldIssues)) {
      continue;
    }

    for (const issue of fieldIssues) {
      const message = getSafeBackendMessage(issue);

      if (message) {
        return message;
      }
    }
  }

  return null;
}

async function readBackendErrorMessage(response: Response): Promise<string> {
  let errorBody: unknown;

  try {
    errorBody = await response.json();
  } catch {
    // Keep the generic error for non-JSON error responses.
  }

  const validationMessage = getValidationMessage(errorBody);
  const backendMessage = isRecord(errorBody) ? getSafeBackendMessage(errorBody.message) : null;

  return validationMessage ?? backendMessage ?? `No se pudo completar la solicitud (HTTP ${response.status}).`;
}

export function getApiBaseUrl(): URL {
  const configuredUrl = appConfig.apiBaseUrl.trim();

  if (!configuredUrl) {
    throw new ConductorApiError('La URL del backend no está configurada. Configura EXPO_PUBLIC_API_BASE_URL.');
  }

  try {
    return new URL(configuredUrl);
  } catch {
    throw new ConductorApiError('La URL del backend no es válida. Configura EXPO_PUBLIC_API_BASE_URL con una URL HTTP(S).');
  }
}

interface ConductorApiRequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}

/**
 * Reusable authenticated fetch wrapper for the conductor HTTP contract.
 * Adds `Authorization: Bearer <token>` from `getSessionToken()`. Throws
 * `SessionUnavailableError` up front instead of sending an unauthenticated
 * request when there is no stored session token.
 */
/**
 * Resolves the `Authorization: Bearer <token>` header value shared by every
 * authenticated conductor request. Throws `SessionUnavailableError` up
 * front, matching `conductorApiRequest`, so callers built outside that
 * helper (e.g. binary responses) stay consistent.
 */
export async function getAuthorizationHeader(): Promise<string> {
  const token = await getSessionToken();

  if (!token) {
    throw new SessionUnavailableError();
  }

  return `Bearer ${token}`;
}

export async function conductorApiRequest<T>(
  path: string,
  options: ConductorApiRequestOptions = {},
): Promise<T> {
  const authorization = await getAuthorizationHeader();
  const apiBaseUrl = getApiBaseUrl();
  const requestUrl = new URL(path, apiBaseUrl);

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: authorization,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ConductorApiError('No fue posible conectar con el backend de RebusqueAPP.');
  }

  if (!response.ok) {
    throw new ConductorApiError(await readBackendErrorMessage(response), response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ConductorApiError('Error de contrato: se esperaba una respuesta JSON del backend.');
  }
}
