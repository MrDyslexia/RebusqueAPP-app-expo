# RebusqueAPP driver app

Expo Router prototype for the first driver vertical slice. It signs drivers in through the deployed authentication contract, opens a session WebSocket, and keeps shipment state server-authoritative.

## Setup

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run start
```

Environment variables:

- `EXPO_PUBLIC_API_BASE_URL`: public API origin used for `POST /auth/login` and the derived WebSocket origin. It is configuration, not a secret.
- `EXPO_PUBLIC_USE_FIXTURES`: set to `true` only for local development navigation fixtures. The default is `false`; production builds use real authentication.

The opaque session token returned by `POST /auth/login` is stored locally with `expo-secure-store`. Real sign-in prefixes the device's native identifier with `expo-`: Android `ANDROID_ID` or iOS IDFV. Never put tokens, device identifiers, or credentials in `EXPO_PUBLIC_*` variables, `.env.example`, documentation, or logs.

`.env` is not currently ignored by this repository's `.gitignore`, so this task does not create one. Expo loads `.env.local`, which this repository already ignores; copy `.env.example` to `.env.local` for local configuration. Do not add session data to either file.

## Fixture mode

With `EXPO_PUBLIC_USE_FIXTURES=true` in a development build, the login screen displays fictional fixture credentials and opens a development-only workspace containing two fixture shipments. Production builds always use real authentication, even if this public variable is set. Their IDs remain strings so future PostgreSQL `BIGINT` values are not truncated by JavaScript.

Fixture mode demonstrates inbox, detail, status chips, documented QR action routes, optional local proof photos, and failed-delivery form validation. It never simulates a successful server validation or shipment mutation.

With fixture mode disabled, the login screen sends `{ "rut": string, "password": string, "deviceIdentifier": string }` to `POST /auth/login`. `deviceIdentifier` is `expo-` followed by the Android `ANDROID_ID` or iOS IDFV. The native device identifier is available only on Android and iOS; unsupported environments stop sign-in before any request. A successful response must contain a non-empty opaque string at `token`; otherwise sign-in fails with an explicit contract error and no session continues.

### Enable fixtures

1. Copy `.env.example` to `.env.local`.
2. Set `EXPO_PUBLIC_USE_FIXTURES=true`.
3. Start the development server with `bun run start`.

Fixtures are development-only. A production build always uses real authentication.

## Package manager

Bun 1.3.14 is the required package manager. `bun.lock` is the committed, reproducible dependency graph; install it with `bun install --frozen-lockfile`.

## EAS builds

This Expo project is linked to EAS under the `lowframes` owner (project ID `10757065-2d25-4e20-8270-16e2d4d2df9d`). Run EAS through Bun with `bunx eas-cli@latest`; do not install the CLI with npm.

```bash
# Development build
bunx eas-cli@latest build --platform android --profile development

# Production build
bunx eas-cli@latest build --platform android --profile production
```

The available build profiles are `development`, `preview`, and `production` in `eas.json`. Remote builds and production credentials have not been created yet.

### Documented npm exception

Use npm only when Bun is unsustainable because of a concrete dependency incompatibility. Before a fallback, record in this README:

- affected dependency and version;
- reproducible Bun command and failure output;
- reason the fallback is required; and
- exact npm command and scope of the exception; and
- duration of the exception.

## Backend contracts still required

- Assigned-shipment list and detail response schemas.
- QR payload, validation request and response schemas, authorization, idempotency, and server-owned business transitions.
- WebSocket shipment-event protocol. The app derives `ws`/`wss` from the configured HTTP(S) origin, appends the opaque token as an encoded `token` query parameter, displays connection/reconnection state, and retains only the latest incoming message as an untyped observation. It does not mutate shipment state from undocumented events.
- Proof photo upload and failed-delivery reporting. The MVP keeps optional photos and validated failed-delivery reasons in the active form only, and clearly reports that no submission occurred.

`ConductorApi` is still the deliberately incomplete boundary for shipment list/detail and QR validation. Do not invent endpoints or payloads before those contracts are approved.

## Verification

```bash
bun run typecheck
bunx expo config --type public
```

The app uses Expo SDK 57 and `expo-camera` with `CameraView`, `useCameraPermissions`, QR-only scanner settings, `onBarcodeScanned`, and local optional proof-photo capture. Captured native photo URIs are temporary; without an approved upload contract the MVP does not persist or transmit them.
