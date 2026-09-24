import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import type { ShipmentStatus } from '@/domain/shipment';
import { getWebSocketUrl } from '@/services/auth-session';

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface RealtimeConnectionState {
  status: RealtimeConnectionStatus;
  reconnectAttempt: number;
}

/** Reduced payload sent on the real `encomienda_actualizada` event — not the full encomienda. */
export interface EncomiendaActualizadaEventData {
  id: number;
  numeroSeguimiento: string;
  estado: ShipmentStatus;
  conductorAsignadoId: number | null;
}

export interface EncomiendaActualizadaEvent {
  type: 'encomienda_actualizada';
  data: EncomiendaActualizadaEventData;
}

/** Any other event shape the backend may send; kept generic since only `encomienda_actualizada` is documented today. */
export interface UnknownRealtimeEvent {
  type: string;
  data: unknown;
}

export type RealtimeEvent = EncomiendaActualizadaEvent | UnknownRealtimeEvent;

export interface RealtimeEventObservation {
  receivedAt: string;
  /** Parsed `{ type, data }` payload, or `null` if `event.data` was not valid JSON matching that shape. */
  event: RealtimeEvent | null;
  /** Raw `event.data` string exactly as received over the socket. */
  rawPayload: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  return isRecord(value) && typeof value.type === 'string' && 'data' in value;
}

export function isEncomiendaActualizadaEvent(event: RealtimeEvent): event is EncomiendaActualizadaEvent {
  return event.type === 'encomienda_actualizada';
}

function parseRealtimeMessage(rawPayload: string): RealtimeEvent | null {
  try {
    const parsed: unknown = JSON.parse(rawPayload);
    return isRealtimeEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface RealtimeConnection {
  disconnect(): void;
}

interface RealtimeConnectionOptions {
  token: string;
  onStateChange: (state: RealtimeConnectionState) => void;
  onEvent: (event: RealtimeEventObservation) => void;
}

const MAX_RECONNECT_DELAY_MS = 30_000;
let positionSocket: WebSocket | null = null;
let sharedSession: {
  token: string;
  connection: RealtimeConnection;
  subscribers: Set<RealtimeConnectionOptions>;
  state: RealtimeConnectionState;
} | null = null;

export function sendRealtimePosition(latitud: number, longitud: number): boolean {
  if (!positionSocket || positionSocket.readyState !== WebSocket.OPEN) return false;
  positionSocket.send(JSON.stringify({ type: 'posicion_actualizada', data: { latitud, longitud } }));
  return true;
}

export function connectRealtimeSession({
  token,
  onStateChange,
  onEvent,
}: RealtimeConnectionOptions): RealtimeConnection {
  const subscriber = { token, onStateChange, onEvent };

  if (sharedSession?.token === token) {
    sharedSession.subscribers.add(subscriber);
    subscriber.onStateChange(sharedSession.state);
    return {
      disconnect() {
        if (!sharedSession || !sharedSession.subscribers.delete(subscriber)) return;
        if (sharedSession.subscribers.size === 0) {
          sharedSession.connection.disconnect();
          sharedSession = null;
        }
      },
    };
  }

  sharedSession?.connection.disconnect();

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let isDisconnected = false;
  // AppState can be null during native bootstrap; connect now and let the
  // first lifecycle event correct it instead of leaving the session offline.
  let isAppActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  let appStateSubscription: NativeEventSubscription | null = null;

  function updateState(status: RealtimeConnectionStatus) {
    const state = { status, reconnectAttempt };
    if (sharedSession?.connection === connection) {
      sharedSession.state = state;
    }
    for (const currentSubscriber of sharedSession?.subscribers ?? [subscriber]) {
      currentSubscriber.onStateChange(state);
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (isDisconnected || !isAppActive || reconnectTimer) {
      return;
    }

    reconnectAttempt += 1;
    updateState('reconnecting');

    const delayMs = Math.min(1_000 * 2 ** (reconnectAttempt - 1), MAX_RECONNECT_DELAY_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  }

  function connect() {
    if (isDisconnected || !isAppActive || socket) {
      return;
    }

    updateState(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

    try {
      const currentSocket = new WebSocket(getWebSocketUrl(token));
      socket = currentSocket;

      currentSocket.onopen = () => {
        if (socket !== currentSocket) return;
        positionSocket = currentSocket;
        reconnectAttempt = 0;
        updateState('connected');
      };

      currentSocket.onmessage = (event) => {
        if (socket !== currentSocket) return;
        const rawPayload = typeof event.data === 'string' ? event.data : String(event.data);
        const observation = {
          receivedAt: new Date().toISOString(),
          event: parseRealtimeMessage(rawPayload),
          rawPayload,
        };
        for (const currentSubscriber of sharedSession?.subscribers ?? [subscriber]) {
          currentSubscriber.onEvent(observation);
        }
      };

      currentSocket.onerror = () => {
        if (socket !== currentSocket) return;
        updateState('error');
        currentSocket.close();
      };

      currentSocket.onclose = () => {
        if (socket !== currentSocket) return;
        if (positionSocket === currentSocket) positionSocket = null;
        socket = null;
        if (!isDisconnected) scheduleReconnect();
      };
    } catch {
      updateState('error');
      scheduleReconnect();
    }
  }

  function handleAppStateChange(nextState: AppStateStatus) {
    isAppActive = nextState === 'active';

    if (isAppActive) {
      reconnectAttempt = 0;
      connect();
      return;
    }

    // Android may suspend timers and preserve a dead socket in memory.
    clearReconnectTimer();
    const activeSocket = socket;
    socket = null;
    if (positionSocket === activeSocket) positionSocket = null;
    activeSocket?.close();
    updateState('disconnected');
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  const connection: RealtimeConnection = {
    disconnect() {
      isDisconnected = true;
      appStateSubscription?.remove();
      appStateSubscription = null;
      clearReconnectTimer();

      const activeSocket = socket;
      socket = null;
      if (positionSocket === activeSocket) positionSocket = null;
      activeSocket?.close();

      updateState('disconnected');
      if (sharedSession?.connection === connection) {
        sharedSession = null;
      }
    },
  };
  sharedSession = {
    token,
    connection,
    subscribers: new Set([subscriber]),
    state: { status: 'connecting', reconnectAttempt: 0 },
  };
  connect();

  return connection;
}
