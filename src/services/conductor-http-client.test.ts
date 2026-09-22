import { afterEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;

mock.module('@/services/session-token-store', () => ({
  getSessionToken: async () => 'test-session-token',
  invalidateSessionAndRedirectToLogin: async () => undefined,
}));

mock.module('@/config/app-config', () => ({
  appConfig: { apiBaseUrl: 'https://api.example.test', fixturesEnabled: false },
}));

const { conductorApiRequest } = await import('./conductor-http-client');

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('conductorApiRequest expectedStatus', () => {
  test('accepts the required 201 response for a position POST', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ posicion: {} }), { status: 201 }));

    await expect(conductorApiRequest('/posiciones', {
      method: 'POST',
      body: {},
      expectedStatus: 201,
    })).resolves.toEqual({ posicion: {} });
  });

  test('rejects another 2xx response when a position POST requires 201', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ posicion: {} }), { status: 200 }));

    await expect(conductorApiRequest('/posiciones', {
      method: 'POST',
      body: {},
      expectedStatus: 201,
    })).rejects.toMatchObject({ status: 200 });
  });
});
