import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// --- react-native AppState mock -------------------------------------------
// The real react-native package uses Flow syntax that bun:test cannot parse,
// and this module only needs AppState. A minimal, controllable mock lets the
// test drive pause -> resume cycles deterministically.
let mockAppState: 'active' | 'background' | 'inactive' = 'active';
let appStateListeners: ((state: string) => void)[] = [];

function simulateAppStateChange(next: 'active' | 'background' | 'inactive'): void {
  mockAppState = next;
  appStateListeners.forEach((listener) => listener(next));
}

mock.module('react-native', () => ({
  AppState: {
    get currentState() {
      return mockAppState;
    },
    addEventListener: (_event: string, handler: (state: string) => void) => {
      appStateListeners.push(handler);
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((listener) => listener !== handler);
        },
      };
    },
  },
}));

// --- expo-location mock -----------------------------------------------------
type WatchPositionCall = {
  resolve: (subscription: { remove: () => void }) => void;
  reject: (error: unknown) => void;
  onLocation: (location: { coords: { latitude: number; longitude: number } }) => void;
  onError: (reason: string) => void;
};

let watchPositionCalls: WatchPositionCall[] = [];

const getProviderStatusAsync = mock(async () => ({ locationServicesEnabled: true, gpsAvailable: true }));

const watchPositionAsync = mock(
  (
    _options: unknown,
    onLocation: WatchPositionCall['onLocation'],
    onError: WatchPositionCall['onError'],
  ) =>
    new Promise<{ remove: () => void }>((resolve, reject) => {
      watchPositionCalls.push({ resolve, reject, onLocation, onError });
    }),
);

mock.module('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getProviderStatusAsync,
  getForegroundPermissionsAsync: mock(async () => ({ status: 'granted' })),
  getBackgroundPermissionsAsync: mock(async () => ({ status: 'denied' })),
  requestForegroundPermissionsAsync: mock(async () => ({ status: 'granted' })),
  requestBackgroundPermissionsAsync: mock(async () => ({ status: 'denied' })),
  hasStartedLocationUpdatesAsync: mock(async () => false),
  startLocationUpdatesAsync: mock(async () => undefined),
  stopLocationUpdatesAsync: mock(async () => undefined),
  watchPositionAsync,
}));

mock.module('expo-task-manager', () => ({
  defineTask: mock(() => undefined),
  isAvailableAsync: mock(async () => false),
}));

const reportPosition = mock(async () => undefined);
const sendRealtimePosition = mock(() => false);
const connectRealtimeSession = mock(() => ({ disconnect: mock(() => undefined) }));

mock.module('@/services/get-conductor-api', () => ({
  getConductorApi: () => ({ reportPosition }),
}));

// bun:test resolves mock.module() by absolute file path, so this mock would
// otherwise leak into session-websocket.test.ts (which imports the same file
// via a relative specifier) and silently replace the real implementation
// under test there. Capture the real exports now — with react-native already
// mocked above and auth-session stubbed so its transitive device-identity ->
// expo-application chain never loads — and restore them in afterAll so other
// test files see the genuine implementation again.
//
// Destructure the concrete function values (not the module namespace object)
// before mocking: mock.module() keeps ESM namespace objects live-bound, so a
// captured namespace reference would silently start pointing at the stub's
// exports too the moment the stub mock.module() call below runs.
mock.module('@/services/auth-session', () => ({
  getWebSocketUrl: () => 'wss://capture-only.invalid',
}));
const {
  connectRealtimeSession: realConnectRealtimeSession,
  sendRealtimePosition: realSendRealtimePosition,
} = await import('@/services/session-websocket');

mock.module('@/services/session-websocket', () => ({
  connectRealtimeSession,
  sendRealtimePosition,
}));

afterAll(() => {
  mock.module('@/services/session-websocket', () => ({
    connectRealtimeSession: realConnectRealtimeSession,
    sendRealtimePosition: realSendRealtimePosition,
  }));
});

mock.module('@/services/session-token-store', () => ({
  getSessionToken: mock(async () => 'test-session-token'),
  invalidateSessionAndRedirectToLogin: mock(async () => undefined),
}));

const { startPositionTracking, stopPositionTracking, getLocationTrackingStatus } = await import('./location-tracking');

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(async () => {
  mockAppState = 'active';
  appStateListeners = [];
  watchPositionCalls = [];
  watchPositionAsync.mockClear();
  getProviderStatusAsync.mockClear();
  reportPosition.mockClear();
  sendRealtimePosition.mockClear();
  sendRealtimePosition.mockImplementation(() => false);
  await stopPositionTracking();
});

describe('location callback transport diagnostics', () => {
  test('records a callback and uses WebSocket without calling the HTTP fallback when it is open', async () => {
    sendRealtimePosition.mockImplementation(() => true);
    void startPositionTracking();
    await flush();

    const attempt = watchPositionCalls[0]!;
    attempt.resolve({ remove: mock(() => undefined) });
    await flush();

    attempt.onLocation({ coords: { latitude: -33.4, longitude: -70.6 } });
    await flush();

    expect(reportPosition).not.toHaveBeenCalled();
    expect(getLocationTrackingStatus()).toMatchObject({
      locationCallbackCount: 1,
      lastLocationCallbackAt: expect.any(Number),
      lastTransportAttempt: {
        type: 'websocket',
        result: 'sent',
        error: null,
      },
    });
  });

  test('uses the HTTP 201 reporting path when the WebSocket is unavailable', async () => {
    void startPositionTracking();
    await flush();

    const attempt = watchPositionCalls[0]!;
    attempt.resolve({ remove: mock(() => undefined) });
    await flush();

    attempt.onLocation({ coords: { latitude: -33.4, longitude: -70.6 } });
    await flush();

    expect(reportPosition).toHaveBeenCalledWith({ latitud: -33.4, longitud: -70.6 });
    expect(getLocationTrackingStatus().lastTransportAttempt).toMatchObject({
      type: 'http',
      result: 'confirmed',
      error: null,
    });
  });
});

describe('startForegroundWatch generation guard', () => {
  test('a background -> foreground transition preserves the live foreground subscription', async () => {
    void startPositionTracking();
    await flush();

    expect(watchPositionCalls).toHaveLength(1);
    const attempt = watchPositionCalls[0]!;
    const remove = mock(() => undefined);
    attempt.resolve({ remove });
    await flush();

    const providerCallsBeforeResume = getProviderStatusAsync.mock.calls.length;
    simulateAppStateChange('background');
    await flush();
    expect(remove).not.toHaveBeenCalled();

    simulateAppStateChange('active');
    await flush();

    expect(watchPositionCalls).toHaveLength(1);
    expect(remove).not.toHaveBeenCalled();
    expect(getProviderStatusAsync.mock.calls.length).toBe(providerCallsBeforeResume + 1);
    expect(getLocationTrackingStatus().foregroundWatcher).toBe('active');
  });

  test('a pause -> resume during an in-flight start retains the eventual subscription without duplicating it', async () => {
    void startPositionTracking();
    await flush();

    expect(watchPositionCalls).toHaveLength(1);

    simulateAppStateChange('background');
    simulateAppStateChange('active');
    await flush();

    expect(watchPositionCalls).toHaveLength(1);

    const firstAttempt = watchPositionCalls[0]!;
    const firstRemove = mock(() => undefined);

    firstAttempt.resolve({ remove: firstRemove });
    await flush();

    expect(firstRemove).not.toHaveBeenCalled();
    expect(getLocationTrackingStatus().foregroundWatcher).toBe('active');

    firstAttempt.onLocation({ coords: { latitude: -33.4, longitude: -70.6 } });
    await flush();
    expect(reportPosition).toHaveBeenCalledTimes(1);
  });

  test('stopPositionTracking removes a live foreground subscription', async () => {
    void startPositionTracking();
    await flush();

    const attempt = watchPositionCalls[0]!;
    const remove = mock(() => undefined);
    attempt.resolve({ remove });
    await flush();

    await stopPositionTracking();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(getLocationTrackingStatus().foregroundWatcher).toBe('inactive');
  });

  test('stopPositionTracking during an in-flight start removes the eventual subscription and never reports "active"', async () => {
    void startPositionTracking();
    await flush();

    expect(watchPositionCalls).toHaveLength(1);
    const attempt = watchPositionCalls[0]!;
    const remove = mock(() => undefined);

    await stopPositionTracking();
    expect(getLocationTrackingStatus().foregroundWatcher).toBe('inactive');

    attempt.resolve({ remove });
    await flush();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(getLocationTrackingStatus().foregroundWatcher).not.toBe('active');
  });
});
