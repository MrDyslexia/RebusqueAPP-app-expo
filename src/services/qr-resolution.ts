import type { AssignedShipment, ShipmentId, ShipmentStatus } from '@/domain/shipment';
import { ConductorApiError, type ConductorApi } from '@/services/conductor-api';
import { invalidateSessionAndRedirectToLogin } from '@/services/session-token-store';

/**
 * Thrown for every QR-resolution outcome the caller must surface to the
 * driver (invalid/expired QR, mismatched shipment, stale state, etc). `401`
 * is the one exception: it is handled here directly (clear session, redirect
 * to login) per the "never auto-retry" rule in `Flujo QR Conductores.md`,
 * but this error is still thrown afterward so callers stop their own flow.
 */
export class QrResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrResolutionError';
  }
}

/**
 * Maps a failure from any conductor API call made during the QR flow
 * (resolve or transition) onto the error table in `Flujo QR Conductores.md`
 * and throws a `QrResolutionError` with a driver-safe message. Always
 * throws; declared as `Promise<never>` for callers that want that intent
 * explicit, but callers should still `throw` after calling it to satisfy
 * TypeScript's control-flow analysis.
 */
async function handleConductorApiError(error: unknown, fallbackMessage: string): Promise<never> {
  if (error instanceof ConductorApiError) {
    if (error.status === 401) {
      // Sesión inválida o reemplazada: borrar sesión y forzar login. Nunca
      // reintentar automáticamente la transición.
      await invalidateSessionAndRedirectToLogin();
      throw new QrResolutionError('Tu sesión ya no es válida. Inicia sesión nuevamente.');
    }

    if (error.status === 403) {
      throw new QrResolutionError('Esta encomienda no está asignada a tu usuario. Informa a un ejecutivo o administrador.');
    }

    if (error.status === 409) {
      throw new QrResolutionError('El estado de la encomienda cambió. Vuelve a escanear el código QR para continuar.');
    }

    // 404 and 400 already carry a driver-safe `message` (see
    // `http-conductor-api.ts` for the 404 override); any other status falls
    // back to the same safe backend message.
    throw new QrResolutionError(error.message);
  }

  throw new QrResolutionError(error instanceof Error ? error.message : fallbackMessage);
}

/**
 * Resolves a raw scanned QR value via `GET /encomiendas/qr/:codigoQr` with
 * no expected shipment to cross-validate against — used by the standalone
 * "unassigned" scanner entry point.
 */
export async function resolveShipmentByQrCode(api: ConductorApi, rawQrValue: string): Promise<AssignedShipment> {
  try {
    return await api.resolveShipmentByQrCode(rawQrValue);
  } catch (error) {
    await handleConductorApiError(error, 'No fue posible resolver el código QR.');
    throw error;
  }
}

/**
 * Resolves a raw scanned QR value and cross-validates the result against the
 * shipment the scanner was opened for — the central Option B rule: the QR
 * only identifies an encomienda, the app must confirm it matches the one
 * already selected on screen before any transition is attempted.
 *
 * `validSourceStatuses`, when provided, adds a defense-in-depth check
 * against the fresh `status` in the resolve response (in case the on-screen
 * state was stale) and throws a clear message instead of only relying on a
 * possible `409` from the transition call itself.
 */
export async function resolveExpectedShipmentByQrCode(
  api: ConductorApi,
  rawQrValue: string,
  expectedShipmentId: ShipmentId,
  validSourceStatuses?: readonly ShipmentStatus[],
): Promise<AssignedShipment> {
  const resolved = await resolveShipmentByQrCode(api, rawQrValue);

  if (resolved.id !== expectedShipmentId) {
    throw new QrResolutionError('Este código QR pertenece a otra encomienda. Escanea el código correcto.');
  }

  if (validSourceStatuses && !validSourceStatuses.includes(resolved.status)) {
    throw new QrResolutionError('La encomienda ya no está en un estado válido para esta acción. Actualiza la pantalla o vuelve a escanear.');
  }

  return resolved;
}

/**
 * Runs the real transition call (`recoger`/`cargar`/`entregar`) after a
 * successful QR match, mapping any failure (especially a `409` if the state
 * changed between the resolve and the transition) onto the same driver-safe
 * error table as the resolve step.
 */
export async function runTransitionAfterQrMatch<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    await handleConductorApiError(error, 'No fue posible completar la acción.');
    throw error;
  }
}
