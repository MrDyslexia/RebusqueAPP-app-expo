# RebusqueAPP Expo instructions

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Package management

- Bun 1.3.14 is the project package manager. Use `bun install`, `bun run`, `bunx`, and `bun expo` as the normal workflow.
- Keep `bun.lock` committed and install with `bun install --frozen-lockfile` when reproducibility matters.

### Documented npm exception

Use npm only when Bun is unsustainable because of a concrete dependency incompatibility. Record all five fields in the README before a fallback: affected dependency and version; reproducible Bun command and failure; reason the fallback is required; the exact command and scope for which npm is allowed; and the duration of the exception.
