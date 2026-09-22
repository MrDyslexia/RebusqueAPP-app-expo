import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

type AppStateListener = (state: 'active' | 'background' | 'inactive') => void;

let currentAppState: 'active' | 'background' | 'inactive' = 'active';
let appStateListeners: AppStateListener[] = [];

function emitAppState(nextState: 'active' | 'background' | 'inactive'): void {
  currentAppState = nextState;
  appStateListeners.forEach((listener) => listener(nextState));
}

mock.module('react-native', () => ({
  AppState: {
    get currentState() {
      return currentAppState;
    },
    addEventListener: (_event: string, listener: AppStateListener) => {
      appStateListeners.push(listener);
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((candidate) => candidate !== listener);
        },
      };
    },
  },
}));

mock.module('@/services/auth-session', () => ({
  getWebSocketUrl: () => 'wss://api.example.test/ws?token=test-token',
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }
}

const originalWebSocket = globalThis.WebSocket;
globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

const { connectRealtimeSession } = await import('./session-websocket');

beforeEach(() => {
  currentAppState = 'active';
  appStateListeners = [];
  MockWebSocket.instances = [];
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

describe('connectRealtimeSession app lifecycle', () => {
  test('creates a fresh socket after Android resumes the application', () => {
    const states: string[] = [];
    const connection = connectRealtimeSession({
      token: 'test-token',
      onEvent: () => undefined,
      onStateChange: (state) => states.push(state.status),
    });

    const initialSocket = MockWebSocket.instances[0]!;
    initialSocket.onopen?.();
    emitAppState('background');

    expect(initialSocket.closed).toBe(true);
    expect(states.at(-1)).toBe('disconnected');

    emitAppState('active');

    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1]!.onopen?.();
    expect(states.at(-1)).toBe('connected');

    connection.disconnect();
    expect(appStateListeners).toHaveLength(0);
  });
});
